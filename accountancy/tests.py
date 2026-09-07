import re

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from accountancy.models import Business

User = get_user_model()


class AuthFlowTests(TestCase):
    REGISTER_URL = '/api/auth/registration/'
    LOGIN_URL = '/api/auth/login/'
    LOGOUT_URL = '/api/auth/logout/'
    VERIFY_URL = '/api/auth/registration/verify-email/'
    REFRESH_URL = '/api/auth/token/refresh/'
    USER_URL = '/api/auth/user/'

    def test_full_registration_to_logout_flow(self):
        client = APIClient()
        email, password = 'owner2@example.com', 'S3cur3Pass!123'

        resp = client.post(self.REGISTER_URL, {'email': email, 'password1': password,
                                                 'password2': password, 'business_name': 'Acme Traders'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        user = User.objects.get(email=email)
        self.assertEqual(Business.objects.get(owner=user).name, 'Acme Traders')

        # login blocked pre-verification
        resp = client.post(self.LOGIN_URL, {'email': email, 'password': password}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.data)

        # extract verification key from the sent email, verify
        self.assertEqual(len(mail.outbox), 1)
        match = re.search(r'account-confirm-email/([^/\s]+)/?', mail.outbox[0].body)
        self.assertIsNotNone(match, mail.outbox[0].body)
        resp = client.post(self.VERIFY_URL, {'key': match.group(1)}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

        # login now succeeds
        resp = client.post(self.LOGIN_URL, {'email': email, 'password': password}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        access, refresh = resp.data['access'], resp.data['refresh']

        # access token works against a protected endpoint
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        resp = client.get(self.USER_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data['email'], email)

        # logout blacklists the refresh token server-side
        resp = client.post(self.LOGOUT_URL, {'refresh': refresh}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        outstanding = OutstandingToken.objects.get(token=refresh)
        self.assertTrue(BlacklistedToken.objects.filter(token=outstanding).exists())

        client.credentials()
        resp = client.post(self.REFRESH_URL, {'refresh': refresh}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED, resp.data)
