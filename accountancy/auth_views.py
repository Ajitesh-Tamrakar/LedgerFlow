"""Code-based email verification and password reset.

Three public endpoints that fill the gap dj-rest-auth doesn't cover. Everything
else (login / logout / refresh / registration / password-change) stays on
dj-rest-auth untouched.

    POST /api/auth/otp/verify-email/      {email, code}
    POST /api/auth/otp/password/request/  {email}
    POST /api/auth/otp/password/confirm/  {email, code, new_password1, new_password2}
"""
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accountancy.serializers import (
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    VerifyEmailCodeSerializer,
)


class _PublicAuthView(APIView):
    """Opt out of the project-wide JWT auth + IsAuthenticated default."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]


class VerifyEmailCodeView(_PublicAuthView):
    throttle_scope = 'otp_verify'

    def post(self, request):
        serializer = VerifyEmailCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Email verified. You can now log in.'})


class PasswordResetRequestView(_PublicAuthView):
    throttle_scope = 'otp_request'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'detail': 'If that email has an account, a reset code has been sent.'}
        )


class PasswordResetConfirmView(_PublicAuthView):
    throttle_scope = 'otp_verify'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password updated. Log in with your new password.'})
