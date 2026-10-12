import os
import re
import shutil
import tempfile
from datetime import date
from io import BytesIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from allauth.account.models import EmailAddress

from accountancy import otp
from accountancy.api.views import CollectionTrendView
from accountancy.models import Bill, Business, Cashbook, Dealer, OTPCode, Payment, Task

User = get_user_model()

REGISTER_URL = '/api/auth/registration/'
RESEND_URL = '/api/auth/registration/resend-email/'
LOGIN_URL = '/api/auth/login/'
LOGOUT_URL = '/api/auth/logout/'
REFRESH_URL = '/api/auth/token/refresh/'
USER_URL = '/api/auth/user/'
VERIFY_CODE_URL = '/api/auth/otp/verify-email/'
RESET_REQUEST_URL = '/api/auth/otp/password/request/'
RESET_CONFIRM_URL = '/api/auth/otp/password/confirm/'


def last_code():
    """The 6-digit code from the most recently sent email."""
    match = re.search(r'\b(\d{6})\b', mail.outbox[-1].body)
    assert match, mail.outbox[-1].body
    return match.group(1)


class AuthFlowTests(TestCase):
    def setUp(self):
        cache.clear()  # reset throttle buckets between tests

    def register(self, client, email, password, business='Acme Traders'):
        return client.post(
            REGISTER_URL,
            {'email': email, 'password1': password, 'password2': password,
             'business_name': business},
            format='json',
        )

    def test_full_registration_to_logout_flow(self):
        client = APIClient()
        email, password = 'owner2@example.com', 'S3cur3Pass!123'

        resp = self.register(client, email, password)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        user = User.objects.get(email=email)
        self.assertEqual(Business.objects.get(owner=user).name, 'Acme Traders')

        # login blocked pre-verification
        resp = client.post(LOGIN_URL, {'email': email, 'password': password}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.data)

        # a code was emailed, not a link
        self.assertEqual(len(mail.outbox), 1)
        self.assertNotIn('account-confirm-email', mail.outbox[0].body)

        # wrong code is rejected and counts as an attempt
        resp = client.post(VERIFY_CODE_URL, {'email': email, 'code': '000000'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.data)

        # correct code verifies
        resp = client.post(VERIFY_CODE_URL, {'email': email, 'code': last_code()}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

        # login now succeeds
        resp = client.post(LOGIN_URL, {'email': email, 'password': password}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        access, refresh = resp.data['access'], resp.data['refresh']

        # access token works against a protected endpoint
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        resp = client.get(USER_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data['email'], email)

        # logout blacklists the refresh token server-side
        resp = client.post(LOGOUT_URL, {'refresh': refresh}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        outstanding = OutstandingToken.objects.get(token=refresh)
        self.assertTrue(BlacklistedToken.objects.filter(token=outstanding).exists())

        client.credentials()
        resp = client.post(REFRESH_URL, {'refresh': refresh}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED, resp.data)

    def test_code_is_single_use(self):
        client = APIClient()
        email, password = 'single@example.com', 'S3cur3Pass!123'
        self.register(client, email, password)
        code = last_code()

        resp = client.post(VERIFY_CODE_URL, {'email': email, 'code': code}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        # replaying the same code fails
        resp = client.post(VERIFY_CODE_URL, {'email': email, 'code': code}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.data)

    def test_resend_issues_a_new_working_code(self):
        client = APIClient()
        email, password = 'resend@example.com', 'S3cur3Pass!123'
        self.register(client, email, password)
        first_code = last_code()

        resp = client.post(RESEND_URL, {'email': email}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        second_code = last_code()
        self.assertNotEqual(first_code, second_code)

        # the superseded code no longer works, the fresh one does
        resp = client.post(VERIFY_CODE_URL, {'email': email, 'code': first_code}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.data)
        resp = client.post(VERIFY_CODE_URL, {'email': email, 'code': second_code}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

    def test_password_reset_by_code_flow(self):
        client = APIClient()
        email, old_pw, new_pw = 'reset@example.com', 'S3cur3Pass!123', 'Br4ndNewPass!456'
        self.register(client, email, old_pw)
        client.post(VERIFY_CODE_URL, {'email': email, 'code': last_code()}, format='json')

        # request a reset code
        resp = client.post(RESET_REQUEST_URL, {'email': email}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        reset_code = last_code()
        self.assertTrue(
            OTPCode.objects.filter(email=email, purpose=OTPCode.PURPOSE_PASSWORD_RESET).exists()
        )

        # confirm with the code + new password
        resp = client.post(
            RESET_CONFIRM_URL,
            {'email': email, 'code': reset_code,
             'new_password1': new_pw, 'new_password2': new_pw},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

        # old password rejected, new password works
        resp = client.post(LOGIN_URL, {'email': email, 'password': old_pw}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.data)
        resp = client.post(LOGIN_URL, {'email': email, 'password': new_pw}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

    def test_password_reset_request_is_enumeration_safe(self):
        client = APIClient()
        resp = client.post(RESET_REQUEST_URL, {'email': 'nobody@example.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(len(mail.outbox), 0)


class DuplicateRegistrationTests(TestCase):
    """Registering an address that already has an unverified account.

    dj-rest-auth's RegisterSerializer only rejects an address that is already
    *verified*, and never consults allauth's own `assess_unique_email` policy.
    That let a second account be created for a pending address, after which
    neither could ever be verified: allauth's partial unique index allows one
    verified row per address, and the old verify step tried to flip every
    matching row at once, so the write failed with an IntegrityError forever.
    """

    def setUp(self):
        cache.clear()

    def register(self, client, email, password, business):
        return client.post(
            REGISTER_URL,
            {'email': email, 'password1': password, 'password2': password,
             'business_name': business},
            format='json',
        )

    def test_repeat_signup_creates_no_second_account(self):
        client = APIClient()
        email = 'pending@example.com'

        first = self.register(client, email, 'S3cur3Pass!123', 'First Shop')
        second = self.register(client, email, 'Different!Pass8', 'Second Shop')

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        # Same response as an original signup: the caller cannot tell the
        # address was taken, so the endpoint reveals nothing.
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)

        self.assertEqual(User.objects.filter(email__iexact=email).count(), 1)
        self.assertEqual(EmailAddress.objects.filter(email__iexact=email).count(), 1)
        self.assertEqual(Business.objects.filter(name__in=['First Shop', 'Second Shop']).count(), 1)

    def test_repeat_signup_leaves_the_original_account_untouched(self):
        client = APIClient()
        email, original = 'pending@example.com', 'S3cur3Pass!123'

        self.register(client, email, original, 'First Shop')
        self.register(client, email, 'Different!Pass8', 'Second Shop')

        user = User.objects.get(email__iexact=email)
        self.assertTrue(user.check_password(original))
        self.assertFalse(user.check_password('Different!Pass8'))
        self.assertEqual(user.business.name, 'First Shop')

    def test_address_is_still_verifiable_after_a_repeat_signup(self):
        """The regression. This sequence used to raise IntegrityError."""
        client = APIClient()
        email, password = 'pending@example.com', 'S3cur3Pass!123'

        self.register(client, email, password, 'First Shop')
        self.register(client, email, 'Different!Pass8', 'Second Shop')

        # The resend path issues a fresh code regardless of how many signups ran.
        client.post(RESEND_URL, {'email': email}, format='json')
        resp = client.post(VERIFY_CODE_URL, {'email': email, 'code': last_code()}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

        resp = client.post(LOGIN_URL, {'email': email, 'password': password}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data['user']['business']['name'], 'First Shop')

    def test_verified_address_is_still_rejected_outright(self):
        client = APIClient()
        email, password = 'done@example.com', 'S3cur3Pass!123'

        self.register(client, email, password, 'First Shop')
        client.post(VERIFY_CODE_URL, {'email': email, 'code': last_code()}, format='json')

        resp = self.register(client, email, password, 'Second Shop')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.data)
        self.assertIn('email', resp.data)

    def test_legacy_duplicates_refuse_instead_of_crashing(self):
        """Rows that predate the registration fix still exist in real databases.

        Verification must pick one and decline the other, not raise. Built
        directly rather than through the API, because the API can no longer
        produce this state.
        """
        email = 'legacy@example.com'
        for n, name in enumerate(['First Shop', 'Second Shop'], start=1):
            user = User.objects.create_user(
                username=f'legacy{n}', email=email, password='S3cur3Pass!123',
            )
            Business.objects.create(name=name, owner=user)
            EmailAddress.objects.create(user=user, email=email, verified=False, primary=True)

        client = APIClient()
        code = otp.issue(email, OTPCode.PURPOSE_VERIFY_EMAIL)
        resp = client.post(VERIFY_CODE_URL, {'email': email, 'code': code}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

        verified = EmailAddress.objects.filter(email__iexact=email, verified=True)
        self.assertEqual(verified.count(), 1)

        # The loser is refused with a message rather than an IntegrityError.
        second = EmailAddress.objects.filter(email__iexact=email, verified=False).get()
        self.assertFalse(second.set_verified())


def as_user(client, user):
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')


def a_pdf(name='bill.pdf', size=32):
    return SimpleUploadedFile(name, b'%PDF-1.4\n' + b'0' * size, content_type='application/pdf')


def a_png(name='page.png', color=(200, 60, 60)):
    """A real (tiny) PNG, so the images -> PDF compile path can open it."""
    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (8, 8), color).save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class DealerAPITests(TestCase):
    LIST = '/api/dealers/'

    def setUp(self):
        self.a = User.objects.create_user('a', 'a@example.com', 'pw')
        self.biz_a = Business.objects.create(name='A Traders', owner=self.a)
        self.b = User.objects.create_user('b', 'b@example.com', 'pw')
        self.biz_b = Business.objects.create(name='B Traders', owner=self.b)
        self.d_a = Dealer.objects.create(name='Acme', business=self.biz_a)
        self.d_b = Dealer.objects.create(name='Globex', business=self.biz_b)
        self.client = APIClient()

    # --- scoping (get_queryset) ---
    def test_list_shows_only_own_business(self):
        as_user(self.client, self.a)
        resp = self.client.get(self.LIST)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual([r['name'] for r in resp.data['results']], ['Acme'])

    def test_other_businesss_dealer_is_404_not_403(self):
        as_user(self.client, self.a)
        self.assertEqual(self.client.get(f'{self.LIST}{self.d_b.pk}/').status_code, 404)
        resp = self.client.patch(f'{self.LIST}{self.d_b.pk}/', {'name': 'x'}, format='json')
        self.assertEqual(resp.status_code, 404)
        self.d_b.refresh_from_db()
        self.assertEqual(self.d_b.name, 'Globex')

    # --- create stamp (perform_create) ---
    def test_create_stamps_business_from_token_ignoring_body(self):
        as_user(self.client, self.a)
        resp = self.client.post(
            self.LIST, {'name': 'Initech', 'business': self.biz_b.pk}, format='json'
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Dealer.objects.get(name='Initech').business, self.biz_a)

    # --- http_method_names (base) ---
    def test_put_and_delete_are_405(self):
        as_user(self.client, self.a)
        self.assertEqual(
            self.client.put(f'{self.LIST}{self.d_a.pk}/', {'name': 'x'}, format='json').status_code,
            405,
        )
        self.assertEqual(self.client.delete(f'{self.LIST}{self.d_a.pk}/').status_code, 405)

    # --- validate_name (serializer + context) ---
    def test_duplicate_name_rejected_per_business(self):
        as_user(self.client, self.a)
        self.assertEqual(
            self.client.post(self.LIST, {'name': 'Acme'}, format='json').status_code, 400
        )
        as_user(self.client, self.b)  # same name, different business -- fine
        self.assertEqual(
            self.client.post(self.LIST, {'name': 'Acme'}, format='json').status_code, 201
        )

    # --- filters run inside the scope ---
    def test_search_and_is_active_stay_scoped(self):
        Dealer.objects.create(name='Acme Retired', business=self.biz_a, is_active=False)
        Dealer.objects.create(name='Acme B-side', business=self.biz_b)
        as_user(self.client, self.a)
        got = sorted(r['name'] for r in self.client.get(self.LIST, {'search': 'acme'}).data['results'])
        self.assertEqual(got, ['Acme', 'Acme Retired'])
        got = [r['name'] for r in self.client.get(self.LIST, {'is_active': 'true'}).data['results']]
        self.assertEqual(got, ['Acme'])

    # --- default ordering (pagination needs a deterministic sort) ---
    def test_list_is_ordered_by_name_by_default(self):
        Dealer.objects.create(name='Zeta', business=self.biz_a)
        Dealer.objects.create(name='Beta', business=self.biz_a)
        as_user(self.client, self.a)
        names = [r['name'] for r in self.client.get(self.LIST).data['results']]
        self.assertEqual(names, ['Acme', 'Beta', 'Zeta'])
        names = [r['name'] for r in self.client.get(self.LIST, {'ordering': '-name'}).data['results']]
        self.assertEqual(names, ['Zeta', 'Beta', 'Acme'])

    # --- permission pair (IsAuthenticated + HasBusiness) ---
    def test_no_token_is_401(self):
        self.assertEqual(self.client.get(self.LIST).status_code, 401)

    def test_user_without_business_is_403(self):
        as_user(self.client, User.objects.create_user('loner', 'loner@example.com', 'pw'))
        self.assertEqual(self.client.get(self.LIST).status_code, 403)


class TaskAPITests(TestCase):
    """Only the parts that differ from Dealer -- the base itself is proven by DealerAPITests."""

    LIST = '/api/tasks/'

    def setUp(self):
        self.a = User.objects.create_user('ta', 'ta@example.com', 'pw')
        self.biz_a = Business.objects.create(name='A Traders', owner=self.a)
        self.b = User.objects.create_user('tb', 'tb@example.com', 'pw')
        self.biz_b = Business.objects.create(name='B Traders', owner=self.b)
        self.t_a = Task.objects.create(title='Call supplier', business=self.biz_a)
        self.t_b = Task.objects.create(title='B only', business=self.biz_b)
        self.client = APIClient()

    # --- the reason Task is its own case: DELETE is on ---
    def test_delete_removes_the_task(self):
        as_user(self.client, self.a)
        self.assertEqual(self.client.delete(f'{self.LIST}{self.t_a.pk}/').status_code, 204)
        self.assertFalse(Task.objects.filter(pk=self.t_a.pk).exists())

    def test_cannot_delete_another_businesss_task(self):
        as_user(self.client, self.a)
        self.assertEqual(self.client.delete(f'{self.LIST}{self.t_b.pk}/').status_code, 404)
        self.assertTrue(Task.objects.filter(pk=self.t_b.pk).exists())

    def test_put_is_still_405(self):
        as_user(self.client, self.a)
        resp = self.client.put(f'{self.LIST}{self.t_a.pk}/', {'title': 'x'}, format='json')
        self.assertEqual(resp.status_code, 405)

    # --- serializer: title required + non-blank (the model allows blank) ---
    def test_blank_or_missing_title_rejected(self):
        as_user(self.client, self.a)
        self.assertEqual(self.client.post(self.LIST, {'title': ''}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.LIST, {'title': '   '}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.LIST, {}, format='json').status_code, 400)

    # --- PATCH replaces the old task_action string dispatch ---
    def test_patch_toggles_done_and_edits_title(self):
        as_user(self.client, self.a)
        self.client.patch(f'{self.LIST}{self.t_a.pk}/', {'is_done': True}, format='json')
        self.t_a.refresh_from_db()
        self.assertTrue(self.t_a.is_done)
        self.client.patch(f'{self.LIST}{self.t_a.pk}/', {'title': 'Renamed'}, format='json')
        self.t_a.refresh_from_db()
        self.assertEqual(self.t_a.title, 'Renamed')

    # --- base still applies to Task (scoping + create stamp) ---
    def test_list_scoped_and_create_stamps_business(self):
        as_user(self.client, self.a)
        titles = [r['title'] for r in self.client.get(self.LIST).data['results']]
        self.assertEqual(titles, ['Call supplier'])
        resp = self.client.post(self.LIST, {'title': 'New', 'business': self.biz_b.pk}, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Task.objects.get(title='New').business, self.biz_a)


_BILL_MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=_BILL_MEDIA)
class BillAPITests(TestCase):
    """Bill-specific behaviour: cross-tenant dealer, file validation, the file endpoint."""

    LIST = '/api/bills/'

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_BILL_MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.a = User.objects.create_user('ba', 'ba@example.com', 'pw')
        self.biz_a = Business.objects.create(name='A Traders', owner=self.a)
        self.b = User.objects.create_user('bb', 'bb@example.com', 'pw')
        self.biz_b = Business.objects.create(name='B Traders', owner=self.b)
        self.dealer_a = Dealer.objects.create(name='Acme', business=self.biz_a)
        self.dealer_b = Dealer.objects.create(name='Globex', business=self.biz_b)
        self.client = APIClient()
        as_user(self.client, self.a)

    def create_bill(self, **over):
        data = {'image': a_pdf(), 'date': '2026-02-01',
                'dealer': self.dealer_a.pk, 'amount': '150.00'}
        data.update(over)
        return self.client.post(self.LIST, data, format='multipart')

    # --- validate_dealer: cross-tenant FK rejected (first real use of context["business"]) ---
    def test_dealer_from_another_business_rejected(self):
        resp = self.create_bill(dealer=self.dealer_b.pk)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('dealer', resp.data)

    # --- validate_image ---
    def test_non_pdf_rejected(self):
        png = SimpleUploadedFile('x.png', b'\x89PNG\r\n', content_type='image/png')
        resp = self.create_bill(image=png)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('image', resp.data)

    @override_settings(MAX_BILL_UPLOAD_BYTES=64)
    def test_oversize_pdf_rejected(self):
        resp = self.create_bill(image=a_pdf(size=500))
        self.assertEqual(resp.status_code, 400)
        self.assertIn('image', resp.data)

    # --- happy create: business stamped, raw path never exposed ---
    def test_create_stamps_business_and_hides_raw_path(self):
        resp = self.create_bill()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Bill.objects.get().business, self.biz_a)
        self.assertNotIn('image', resp.data)                       # write-only
        self.assertIn('/api/bills/', resp.data['file_url'])         # the endpoint...
        self.assertNotIn('/bill_imgs/', resp.data['file_url'])      # ...not the media path

    # --- the file endpoint ---
    def test_file_endpoint_inline_and_attachment(self):
        bill_id = self.create_bill().data['id']
        resp = self.client.get(f'{self.LIST}{bill_id}/file/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['Content-Type'], 'application/pdf')
        self.assertTrue(resp['Content-Disposition'].startswith('inline'))
        resp = self.client.get(f'{self.LIST}{bill_id}/file/?download=1')
        self.assertTrue(resp['Content-Disposition'].startswith('attachment'))

    def test_file_endpoint_is_tenant_scoped(self):
        other = Bill.objects.create(image=a_pdf(), date='2026-01-01',
                                    dealer=self.dealer_b, business=self.biz_b, amount=1)
        self.assertEqual(self.client.get(f'{self.LIST}{other.pk}/file/').status_code, 404)

    # --- method gating + filters ---
    def test_delete_is_405(self):
        bill_id = self.create_bill().data['id']
        self.assertEqual(self.client.delete(f'{self.LIST}{bill_id}/').status_code, 405)

    def test_list_scoped_and_filtered(self):
        self.create_bill(date='2026-02-10')
        self.create_bill(date='2026-03-15')
        Bill.objects.create(image=a_pdf(), date='2026-02-11',
                            dealer=self.dealer_b, business=self.biz_b, amount=1)
        self.assertEqual(self.client.get(self.LIST).data['count'], 2)                     # B's excluded
        self.assertEqual(self.client.get(self.LIST, {'date_from': '2026-03-01'}).data['count'], 1)
        self.assertEqual(self.client.get(self.LIST, {'dealer': self.dealer_a.pk}).data['count'], 2)

    # --- the photo-pages path: images -> one compiled PDF ---
    def test_create_from_photo_pages_compiles_one_pdf(self):
        resp = self.client.post(self.LIST, {
            'images': [a_png('a.png'), a_png('b.png', color=(10, 120, 10))],
            'dealer': self.dealer_a.pk, 'date': '2026-02-01', 'amount': '150.00',
        }, format='multipart')
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data['pages'], 2)
        self.assertIsInstance(resp.data['file_size'], int)
        self.assertGreater(resp.data['file_size'], 0)
        bill = Bill.objects.get()
        self.assertEqual(bill.pages, 2)
        self.assertEqual(bill.image.open('rb').read(4), b'%PDF')   # really a PDF

    def test_create_with_both_image_and_images_rejected(self):
        resp = self.create_bill(images=[a_png('a.png')])            # image present by default
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Not both', str(resp.data))

    def test_create_without_any_file_rejected(self):
        resp = self.client.post(self.LIST, {
            'dealer': self.dealer_a.pk, 'date': '2026-02-01', 'amount': '150.00',
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('image', resp.data)

    # --- page validation: the accepted set, HEIC called out by name ---
    def test_heic_page_rejected_names_the_format(self):
        heic = SimpleUploadedFile('photo.heic', b'\x00' * 32, content_type='image/heic')
        resp = self.client.post(self.LIST, {
            'images': [heic], 'dealer': self.dealer_a.pk,
            'date': '2026-02-01', 'amount': '150.00',
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        message = str(resp.data['images'])
        self.assertIn('HEIC/HEIF', message)
        self.assertIn('PDF', message)                              # the accepted list
        self.assertIn('WEBP', message)

    def test_heic_extension_caught_even_with_bogus_content_type(self):
        heic = SimpleUploadedFile('photo.heic', b'\x00' * 32, content_type='application/octet-stream')
        resp = self.client.post(self.LIST, {
            'images': [heic], 'dealer': self.dealer_a.pk,
            'date': '2026-02-01', 'amount': '150.00',
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('HEIC/HEIF', str(resp.data['images']))

    def test_non_image_page_rejected(self):
        text = SimpleUploadedFile('notes.txt', b'hello', content_type='text/plain')
        resp = self.client.post(self.LIST, {
            'images': [text], 'dealer': self.dealer_a.pk,
            'date': '2026-02-01', 'amount': '150.00',
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('PDF', str(resp.data['images']))

    @override_settings(MAX_BILL_UPLOAD_BYTES=64)
    def test_oversize_pages_rejected(self):
        resp = self.client.post(self.LIST, {
            'images': [a_png('a.png'), a_png('b.png', color=(10, 120, 10))],
            'dealer': self.dealer_a.pk, 'date': '2026-02-01', 'amount': '150.00',
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('too large', str(resp.data['images']))

    # --- the API's amount floor is strictly greater than zero ---
    def test_zero_amount_rejected(self):
        for value in ('0', '0.00'):
            resp = self.create_bill(amount=value)
            self.assertEqual(resp.status_code, 400, (value, resp.data))
            self.assertIn('amount', resp.data)

    def test_missing_amount_rejected(self):
        resp = self.client.post(self.LIST, {
            'image': a_pdf(), 'dealer': self.dealer_a.pk, 'date': '2026-02-01',
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('amount', resp.data)

    # --- file replacement: a new source in, the old file out ---
    def test_file_replacement_via_pages(self):
        bill_id = self.create_bill().data['id']
        before = len(_media_files())
        resp = self.client.patch(f'{self.LIST}{bill_id}/', {
            'images': [a_png('x.png'), a_png('y.png', color=(1, 2, 3))],
        }, format='multipart')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['pages'], 2)
        self.assertEqual(len(_media_files()), before)   # old file removed, one stored

    def test_pdf_replacement_forgets_page_count(self):
        resp = self.client.post(self.LIST, {
            'images': [a_png('a.png')], 'dealer': self.dealer_a.pk,
            'date': '2026-02-01', 'amount': '10.00',
        }, format='multipart')
        bill_id = resp.data['id']
        self.assertEqual(resp.data['pages'], 1)
        resp = self.client.patch(f'{self.LIST}{bill_id}/', {'image': a_pdf()},
                                 format='multipart')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIsNone(resp.data['pages'])           # a dropped-in PDF: can't count

    def test_metadata_only_patch_keeps_file_and_pages(self):
        resp = self.client.post(self.LIST, {
            'images': [a_png('a.png')], 'dealer': self.dealer_a.pk,
            'date': '2026-02-01', 'amount': '10.00',
        }, format='multipart')
        bill = Bill.objects.get(pk=resp.data['id'])
        stored_name = bill.image.name
        resp = self.client.patch(f'{self.LIST}{bill.pk}/', {'amount': '200.00'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        bill.refresh_from_db()
        self.assertEqual(bill.image.name, stored_name)  # the file is untouched
        self.assertEqual(bill.pages, 1)

    # --- the rows carry what the list screen renders ---
    def test_list_rows_carry_dealer_status_and_file_size(self):
        self.create_bill()
        self.dealer_a.is_active = False
        self.dealer_a.save()
        row = self.client.get(self.LIST).data['results'][0]
        self.assertFalse(row['dealer_active'])
        self.assertIsInstance(row['file_size'], int)
        self.assertIsNone(row['pages'])                 # created from a PDF


def _media_files():
    found = []
    for _root, _dirs, files in os.walk(_BILL_MEDIA):
        found.extend(os.path.join(_root, name) for name in files)
    return found


@override_settings(MEDIA_ROOT=_BILL_MEDIA)
class BillPurchasesAPITests(TestCase):
    """The Bills page's purchases summary: scoping, shape, the per-dealer split."""

    URL = '/api/bills/purchases/'

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_BILL_MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.a = User.objects.create_user('pa', 'pa@example.com', 'pw')
        self.biz_a = Business.objects.create(name='A Traders', owner=self.a)
        self.b = User.objects.create_user('pb', 'pb@example.com', 'pw')
        self.biz_b = Business.objects.create(name='B Traders', owner=self.b)
        self.dealer_a = Dealer.objects.create(name='Acme', business=self.biz_a)
        self.dealer_a2 = Dealer.objects.create(name='Globex', business=self.biz_a)
        self.dealer_b = Dealer.objects.create(name='Initech', business=self.biz_b)
        self.client = APIClient()
        as_user(self.client, self.a)

    def create_bill(self, dealer, when, amount):
        Bill.objects.create(image=a_pdf(), date=when, dealer=dealer,
                            business=dealer.business, amount=amount)

    def test_summary_scoped_total_count_and_breakdown(self):
        today = timezone.localdate()
        first = today.replace(day=1)
        self.create_bill(self.dealer_a, first, '1000.00')
        self.create_bill(self.dealer_a, today, '250.50')
        self.create_bill(self.dealer_a2, first, '400.00')
        self.create_bill(self.dealer_b, first, '9999.00')    # other tenant

        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, 200)
        data = resp.data
        self.assertEqual(data['period'], 'month')
        self.assertEqual(data['label'], first.strftime('%B'))
        self.assertEqual(data['start'], str(first))
        self.assertEqual(data['count'], 3)
        self.assertEqual(data['total'], '1650.50')
        self.assertEqual([row['id'] for row in data['dealers']],
                         [self.dealer_a.pk, self.dealer_a2.pk])
        self.assertEqual([row['name'] for row in data['dealers']], ['Acme', 'Globex'])
        self.assertEqual([row['total'] for row in data['dealers']], ['1250.50', '400.00'])

    def test_empty_period_reads_zero(self):
        data = self.client.get(self.URL).data
        self.assertEqual(data['total'], '0.00')
        self.assertEqual(data['count'], 0)
        self.assertEqual(data['dealers'], [])

    def test_invalid_period_rejected(self):
        resp = self.client.get(self.URL, {'period': 'year'})
        self.assertEqual(resp.status_code, 400)
        self.assertIn('period', resp.data)


class PaymentAPITests(TestCase):
    """Payment-specific: the method enum, the /methods/ endpoint, the amount floor, the DB constraint."""

    LIST = '/api/payments/'

    def setUp(self):
        self.a = User.objects.create_user('pa', 'pa@example.com', 'pw')
        self.biz_a = Business.objects.create(name='A Traders', owner=self.a)
        self.b = User.objects.create_user('pb', 'pb@example.com', 'pw')
        self.biz_b = Business.objects.create(name='B Traders', owner=self.b)
        self.dealer_a = Dealer.objects.create(name='Acme', business=self.biz_a)
        self.dealer_b = Dealer.objects.create(name='Globex', business=self.biz_b)
        self.client = APIClient()
        as_user(self.client, self.a)

    def create_payment(self, **over):
        data = {'dealer': self.dealer_a.pk, 'date': '2026-02-01',
                'amount': '500.00', 'method': 'upi'}
        data.update(over)
        return self.client.post(self.LIST, data, format='json')

    # --- the method enum ---
    def test_invalid_method_rejected(self):
        resp = self.create_payment(method='banana')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('method', resp.data)

    def test_valid_method_accepted(self):
        self.assertEqual(self.create_payment(method='cheque').status_code, 201)

    def test_methods_endpoint_lists_the_enum(self):
        resp = self.client.get(f'{self.LIST}methods/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            {row['value'] for row in resp.data},
            {'cash', 'upi', 'card', 'cheque', 'bank_transfer'},
        )
        self.assertIn('label', resp.data[0])

    def test_filter_by_method(self):
        self.create_payment(method='cash')
        self.create_payment(method='cash')
        self.create_payment(method='upi')
        self.assertEqual(self.client.get(self.LIST, {'method': 'cash'}).data['count'], 2)

    # --- the amount floor (mirrors the BillSerializer guard) ---
    def test_zero_amount_rejected(self):
        resp = self.create_payment(amount='0.00')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('amount', resp.data)

    def test_negative_amount_rejected(self):
        resp = self.create_payment(amount='-50.00')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('amount', resp.data)

    def test_missing_amount_rejected(self):
        data = {'dealer': self.dealer_a.pk, 'date': '2026-02-01', 'method': 'upi'}
        resp = self.client.post(self.LIST, data, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('amount', resp.data)

    # --- DB constraint: enforced even bypassing the serializer ---
    def test_db_rejects_bad_method(self):
        from django.db import IntegrityError, transaction
        with self.assertRaises(IntegrityError), transaction.atomic():
            Payment.objects.create(dealer=self.dealer_a, business=self.biz_a,
                                   date='2026-01-01', amount=1, method='banana')

    # --- shared DealerScopedMixin still applies to Payment ---
    def test_dealer_from_another_business_rejected(self):
        resp = self.create_payment(dealer=self.dealer_b.pk)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('dealer', resp.data)

    # --- method gating + base ---
    def test_delete_is_405_and_create_stamps_business(self):
        pid = self.create_payment().data['id']
        self.assertEqual(self.client.delete(f'{self.LIST}{pid}/').status_code, 405)
        self.assertEqual(Payment.objects.get(pk=pid).business, self.biz_a)


class BusinessAPITests(TestCase):
    """The singleton -- no {id}, GET/PATCH only, plus the nested copy in /api/auth/user/."""

    URL = '/api/business/'
    USER_URL = '/api/auth/user/'

    def setUp(self):
        self.a = User.objects.create_user('bza', 'bza@example.com', 'pw')
        self.biz_a = Business.objects.create(name='A Traders', owner=self.a)
        self.b = User.objects.create_user('bzb', 'bzb@example.com', 'pw')
        self.biz_b = Business.objects.create(name='B Traders', owner=self.b)
        self.client = APIClient()

    def test_get_returns_own_business_without_owner(self):
        as_user(self.client, self.a)
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['name'], 'A Traders')
        self.assertEqual(resp.data['id'], self.biz_a.id)
        self.assertNotIn('owner', resp.data)

    def test_patch_renames(self):
        as_user(self.client, self.a)
        resp = self.client.patch(self.URL, {'name': 'A Wholesale'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.biz_a.refresh_from_db()
        self.assertEqual(self.biz_a.name, 'A Wholesale')

    def test_put_is_405(self):
        as_user(self.client, self.a)
        self.assertEqual(self.client.put(self.URL, {'name': 'x'}, format='json').status_code, 405)

    def test_no_id_route(self):
        as_user(self.client, self.a)
        self.assertEqual(self.client.get(f'{self.URL}{self.biz_b.id}/').status_code, 404)

    def test_each_user_sees_only_their_own(self):
        as_user(self.client, self.b)
        self.assertEqual(self.client.get(self.URL).data['name'], 'B Traders')

    def test_user_endpoint_nests_business(self):
        as_user(self.client, self.a)
        resp = self.client.get(self.USER_URL)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['business'], {'id': self.biz_a.id, 'name': 'A Traders'})

    def test_no_token_401_and_businessless_403(self):
        self.assertEqual(self.client.get(self.URL).status_code, 401)
        as_user(self.client, User.objects.create_user('bzl', 'bzl@example.com', 'pw'))
        self.assertEqual(self.client.get(self.URL).status_code, 403)


class CashbookAPITests(TestCase):
    """Addressed by date, not id: PUT upserts, GET/DELETE 404 a missing day."""

    LIST = '/api/cashbook/'
    DAY = '/api/cashbook/by-date/2026-02-01/'

    def setUp(self):
        self.a = User.objects.create_user('ca', 'ca@example.com', 'pw')
        self.biz_a = Business.objects.create(name='A Traders', owner=self.a)
        self.b = User.objects.create_user('cb', 'cb@example.com', 'pw')
        self.biz_b = Business.objects.create(name='B Traders', owner=self.b)
        self.client = APIClient()
        as_user(self.client, self.a)

    def put_day(self, url=None, **amounts):
        body = {'upi': '0', 'cash': '0', 'cards': '0'}
        body.update({k: str(v) for k, v in amounts.items()})
        return self.client.put(url or self.DAY, body, format='json')

    def test_get_missing_day_is_404(self):
        self.assertEqual(self.client.get(self.DAY).status_code, 404)

    def test_put_creates_then_replaces_same_row(self):
        resp = self.put_day(upi=100, cash=50)
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data['total'], '150.00')
        resp = self.put_day(upi=200, cards=25)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['total'], '225.00')
        self.assertEqual(
            Cashbook.objects.filter(business=self.biz_a, date='2026-02-01').count(), 1
        )

    def test_put_is_idempotent(self):
        self.put_day(upi=10, cash=20, cards=30)
        resp = self.put_day(upi=10, cash=20, cards=30)          # again -- no error, no dup
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            Cashbook.objects.filter(business=self.biz_a, date='2026-02-01').count(), 1
        )

    def test_delete_then_get_404(self):
        self.put_day(upi=5)
        self.assertEqual(self.client.delete(self.DAY).status_code, 204)
        self.assertEqual(self.client.get(self.DAY).status_code, 404)

    def test_no_post_no_patch(self):
        self.assertEqual(self.client.post(self.LIST, {'upi': 1}, format='json').status_code, 405)
        self.put_day(upi=1)
        self.assertEqual(self.client.patch(self.DAY, {'upi': '2'}, format='json').status_code, 405)

    def test_bad_date_in_url_is_404(self):
        self.assertEqual(self.client.get('/api/cashbook/by-date/banana/').status_code, 404)

    def test_total_is_server_computed_and_uneditable(self):
        resp = self.client.put(self.DAY, {'upi': '7', 'cash': '3', 'cards': '0', 'total': '999'},
                               format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['total'], '10.00')            # not 999

    def test_scoped_by_business(self):
        self.put_day(upi=9)
        as_user(self.client, self.b)
        self.assertEqual(self.client.get(self.DAY).status_code, 404)   # B has no row that date
        self.assertEqual(self.client.get(self.LIST).data['count'], 0)

    def test_list_date_range(self):
        for d in ('2026-01-05', '2026-02-01', '2026-03-10'):
            self.put_day(url=f'/api/cashbook/by-date/{d}/', upi=1)
        self.assertEqual(self.client.get(self.LIST).data['count'], 3)
        self.assertEqual(self.client.get(self.LIST, {'date_from': '2026-02-01'}).data['count'], 2)
        self.assertEqual(self.client.get(self.LIST, {'date_to': '2026-01-31'}).data['count'], 1)

    def test_negative_amount_rejected(self):
        self.assertEqual(self.put_day(upi=-5).status_code, 400)


class CollectionTrendAPITests(TestCase):
    """The computed summary: period comparison + gap-filled trend.

    Not a viewset -- no model behind it, so there is no list/CRUD to test;
    only the calculation, the scoping, and the auth pair."""

    URL = "/api/collection-trend/"

    def setUp(self):
        self.a = User.objects.create_user("cta", "cta@example.com", "pw")
        self.biz_a = Business.objects.create(name="A Traders", owner=self.a)
        self.b = User.objects.create_user("ctb", "ctb@example.com", "pw")
        self.biz_b = Business.objects.create(name="B Traders", owner=self.b)
        self.client = APIClient()
        as_user(self.client, self.a)

    def _cash(self, business, day, **amounts):
        return Cashbook.objects.create(business=business, date=day, **amounts)

    def request_trend(self, day, **params):
        # pin "today" so the calendar periods are the same no matter when the suite runs
        with mock.patch.object(CollectionTrendView, "_today", return_value=day):
            return self.client.get(self.URL, params or None)

    # --- month: the spec's own example (1,72,000 vs 1,64,000 -> +4.88%) ---
    def test_month_matches_the_spec_example(self):
        self._cash(self.biz_a, date(2026, 10, 1), cards="172000")
        self._cash(self.biz_a, date(2026, 9, 15), cards="164000")
        data = self.request_trend(date(2026, 10, 8)).data

        self.assertEqual(data["period"], "month")
        self.assertEqual(data["granularity"], "day")
        self.assertEqual(data["current"], {
            "label": "October", "start": "2026-10-01", "end": "2026-10-31",
            "total": "172000.00",
        })
        self.assertEqual(data["previous"]["label"], "September")
        self.assertEqual(data["previous"]["total"], "164000.00")
        self.assertEqual(data["change_percent"], 4.88)
        self.assertEqual(len(data["trend"]), 31)                    # full axis...
        self.assertEqual(data["trend"][0]["amount"], "172000.00")
        self.assertEqual(data["trend"][1]["amount"], "0.00")        # ...missing days as 0

    # --- week: calendar week, day buckets, previous week compared ---
    def test_week_buckets_by_day_across_the_calendar_week(self):
        self._cash(self.biz_a, date(2026, 10, 6), upi=30)
        self._cash(self.biz_a, date(2026, 10, 8), cash=20)
        self._cash(self.biz_a, date(2026, 9, 30), cards=10)    # previous week
        self._cash(self.biz_a, date(2026, 10, 12), upi=999)    # next week, excluded
        data = self.request_trend(date(2026, 10, 8), period="week").data

        self.assertEqual(data["current"]["label"], "Wk of 5 Oct")
        self.assertEqual(data["current"]["total"], "50.00")
        self.assertEqual(data["previous"]["label"], "Wk of 28 Sep")
        self.assertEqual(data["previous"]["total"], "10.00")
        self.assertEqual(data["change_percent"], 400.0)
        self.assertEqual(len(data["trend"]), 7)
        self.assertEqual(data["trend"][1]["label"], "6 Oct")
        self.assertEqual(data["trend"][1]["amount"], "30.00")

    # --- quarter: week buckets (90+ daily points would be unreadable) ---
    def test_quarter_buckets_by_week(self):
        self._cash(self.biz_a, date(2026, 10, 5), upi=100)     # first bucket
        self._cash(self.biz_a, date(2026, 11, 2), upi=50)
        self._cash(self.biz_a, date(2026, 12, 30), cards=25)   # last partial week
        self._cash(self.biz_a, date(2026, 9, 28), upi=999)     # Q3 -> the previous period
        data = self.request_trend(date(2026, 10, 8), period="quarter").data

        self.assertEqual(data["granularity"], "week")
        self.assertEqual(data["current"]["label"], "Q4 2026")
        self.assertEqual(data["previous"]["label"], "Q3 2026")
        self.assertEqual(data["current"]["total"], "175.00")
        self.assertEqual(data["previous"]["total"], "999.00")
        self.assertEqual(data["change_percent"], -82.48)
        self.assertEqual(len(data["trend"]), 14)

    # --- comparison edge cases ---
    def test_zero_previous_period_reports_null_change(self):
        self._cash(self.biz_a, date(2026, 10, 8), upi=100)
        data = self.request_trend(date(2026, 10, 8), period="week").data
        self.assertEqual(data["previous"]["total"], "0.00")
        self.assertIsNone(data["change_percent"])

    def test_previous_period_crosses_the_year_boundary(self):
        self._cash(self.biz_a, date(2026, 1, 1), upi=7)
        self._cash(self.biz_a, date(2025, 12, 15), upi=5)
        data = self.request_trend(date(2026, 1, 1)).data
        self.assertEqual(data["current"]["label"], "January")
        self.assertEqual(data["previous"]["label"], "December")
        self.assertEqual(data["current"]["total"], "7.00")
        self.assertEqual(data["previous"]["total"], "5.00")
        self.assertEqual(data["change_percent"], 40.0)

    # --- scoping + auth + gating (the mixin) ---
    def test_another_business_collections_are_excluded(self):
        self._cash(self.biz_a, date(2026, 10, 1), upi=100)
        self._cash(self.biz_b, date(2026, 10, 1), upi=9999)
        self.assertEqual(self.request_trend(date(2026, 10, 8)).data["current"]["total"], "100.00")

    def test_invalid_period_is_400(self):
        resp = self.request_trend(date(2026, 10, 8), period="year")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("period", resp.data)

    def test_period_param_is_case_insensitive(self):
        self.assertEqual(self.request_trend(date(2026, 10, 8), period="Month").status_code, 200)

    def test_write_methods_and_missing_accounts_rejected(self):
        self.assertEqual(self.client.post(self.URL, {}).status_code, 405)
        self.client.credentials()
        self.assertEqual(self.client.get(self.URL).status_code, 401)
        as_user(self.client, User.objects.create_user("ctz", "ctz@example.com", "pw"))
        self.assertEqual(self.client.get(self.URL).status_code, 403)
