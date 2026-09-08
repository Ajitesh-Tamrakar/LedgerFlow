"""One-time-code engine for email verification and password reset.

Kept deliberately small and stateless: a code is a hashed row in `OTPCode`,
looked up by (email, purpose). No sessions, no allauth by-code flow.

Public surface:
    generate_code()                     -> str
    issue(email, purpose, *, enforce_cooldown=False) -> str   (plaintext, for the email)
    verify(email, purpose, code)        -> None   (raises OTPError on any failure)
    send_code_email(email, code, purpose) -> None
"""
import hashlib
import hmac
from datetime import timedelta
from secrets import randbelow

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone

from accountancy.models import OTPCode

_CONF = getattr(settings, 'OTP', {})

CODE_LENGTH = _CONF.get('CODE_LENGTH', 6)
MAX_ATTEMPTS = _CONF.get('MAX_ATTEMPTS', 5)
RESEND_COOLDOWN = timedelta(seconds=_CONF.get('RESEND_COOLDOWN_SECONDS', 60))
TTL = {
    OTPCode.PURPOSE_VERIFY_EMAIL: timedelta(
        minutes=_CONF.get('VERIFY_EMAIL_TTL_MINUTES', 15)
    ),
    OTPCode.PURPOSE_PASSWORD_RESET: timedelta(
        minutes=_CONF.get('PASSWORD_RESET_TTL_MINUTES', 10)
    ),
}
_LABEL = {
    OTPCode.PURPOSE_VERIFY_EMAIL: 'Verify your email',
    OTPCode.PURPOSE_PASSWORD_RESET: 'Reset your password',
}


class OTPError(Exception):
    """Any verification failure surfaced to the client as one opaque message."""


def generate_code() -> str:
    return f'{randbelow(10 ** CODE_LENGTH):0{CODE_LENGTH}d}'


def hash_code(code: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256
    ).hexdigest()


def issue(email: str, purpose: str, *, enforce_cooldown: bool = False) -> str:
    """Invalidate any prior live code for (email, purpose), mint a fresh one,
    return the plaintext for delivery. Set `enforce_cooldown` on client-facing
    resend paths; leave it off for the registration send (no prior code exists)."""
    now = timezone.now()
    latest = (
        OTPCode.objects.filter(email=email, purpose=purpose)
        .order_by('-created_at')
        .first()
    )
    if enforce_cooldown and latest and now - latest.created_at < RESEND_COOLDOWN:
        wait = int((RESEND_COOLDOWN - (now - latest.created_at)).total_seconds()) + 1
        raise OTPError(f'Please wait {wait}s before requesting another code.')

    OTPCode.objects.filter(
        email=email, purpose=purpose, consumed_at__isnull=True
    ).update(consumed_at=now)

    code = generate_code()
    OTPCode.objects.create(
        email=email,
        code_hash=hash_code(code),
        purpose=purpose,
        expires_at=now + TTL[purpose],
    )
    return code


def verify(email: str, purpose: str, code: str) -> None:
    """Consume the latest live code for (email, purpose). Raise OTPError otherwise."""
    now = timezone.now()
    otp = (
        OTPCode.objects.filter(
            email=email, purpose=purpose, consumed_at__isnull=True
        )
        .order_by('-created_at')
        .first()
    )
    if otp is None:
        raise OTPError('No active code. Request a new one.')
    if otp.expires_at <= now:
        raise OTPError('Code expired. Request a new one.')
    if otp.attempt_count >= MAX_ATTEMPTS:
        otp.consumed_at = now
        otp.save(update_fields=['consumed_at'])
        raise OTPError('Too many attempts. Request a new one.')

    if not hmac.compare_digest(otp.code_hash, hash_code(code)):
        otp.attempt_count += 1
        if otp.attempt_count >= MAX_ATTEMPTS:
            otp.consumed_at = now
            otp.save(update_fields=['attempt_count', 'consumed_at'])
        else:
            otp.save(update_fields=['attempt_count'])
        raise OTPError('Incorrect code.')

    otp.consumed_at = now
    otp.save(update_fields=['consumed_at'])


def send_code_email(email: str, code: str, purpose: str) -> None:
    label = _LABEL[purpose]
    ttl_minutes = int(TTL[purpose].total_seconds() // 60)
    body = render_to_string(
        'accountancy/email/otp_code.txt',
        {'code': code, 'label': label, 'ttl_minutes': ttl_minutes},
    )
    send_mail(
        subject=f'{label} — one-time code',
        message=body,
        from_email=None,  # DEFAULT_FROM_EMAIL
        recipient_list=[email],
    )
