"""Code-based auth endpoints, mounted at /api/auth/otp/ by jbb_projects.urls."""
from django.urls import path

from accountancy.auth_views import (
    PasswordResetConfirmView,
    PasswordResetRequestView,
    VerifyEmailCodeView,
)

urlpatterns = [
    path('verify-email/', VerifyEmailCodeView.as_view(), name='otp_verify_email'),
    path('password/request/', PasswordResetRequestView.as_view(), name='otp_password_request'),
    path('password/confirm/', PasswordResetConfirmView.as_view(), name='otp_password_confirm'),
]
