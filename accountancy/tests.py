import re

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from accountancy.models import Business, Dealer, OTPCode, Task

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


def as_user(client, user):
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')


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
