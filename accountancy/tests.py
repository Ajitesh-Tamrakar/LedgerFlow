import re

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from accountancy.models import Business, OTPCode

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
