"""Account adapter that swaps allauth's email-confirmation *link* for a
one-time *code*.

allauth still creates the unverified `EmailAddress` on signup and still calls
`send_confirmation_mail` on both registration and `/registration/resend-email/`
-- we just intercept that one method. The verified flag is later flipped by
`POST /api/auth/otp/verify-email/`. `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'`
stays on, so dj-rest-auth's login gate keeps working untouched.
"""
from allauth.account.adapter import DefaultAccountAdapter

from accountancy import otp
from accountancy.models import OTPCode


class CodeEmailAdapter(DefaultAccountAdapter):
    def send_confirmation_mail(self, request, emailconfirmation, signup):
        email = emailconfirmation.email_address.email
        code = otp.issue(email, OTPCode.PURPOSE_VERIFY_EMAIL)
        otp.send_code_email(email, code, OTPCode.PURPOSE_VERIFY_EMAIL)
