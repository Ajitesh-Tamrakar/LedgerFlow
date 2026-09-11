from allauth.account.models import EmailAddress
from dj_rest_auth.registration.serializers import RegisterSerializer
from dj_rest_auth.serializers import UserDetailsSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accountancy import otp
from accountancy.models import Business, OTPCode

User = get_user_model()


class CustomUserDetailsSerializer(UserDetailsSerializer):
    """GET /api/auth/user/ -- dj-rest-auth's user payload plus a read-only copy
    of the caller's business, so the app's post-login bootstrap is one call.
    Renaming still goes through PATCH /api/business/."""

    business = serializers.SerializerMethodField()

    class Meta(UserDetailsSerializer.Meta):
        fields = UserDetailsSerializer.Meta.fields + ('business',)

    def get_business(self, obj):
        biz = getattr(obj, 'business', None)
        return {'id': biz.id, 'name': biz.name} if biz else None


class CustomRegisterSerializer(RegisterSerializer):
    business_name = serializers.CharField(max_length=100, required=True)

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data['business_name'] = self.validated_data.get('business_name', '')
        return data

    def custom_signup(self, request, user):
        Business.objects.create(
            name=self.cleaned_data.get('business_name', ''),
            owner=user,
        )

    def save(self, request):
        """Never create a second account for an address that already has a
        pending one.

        allauth already refuses this. With PREVENT_ENUMERATION on and
        verification mandatory -- both true here -- `assess_unique_email`
        reports the address as "in use, but hide that", and allauth's own
        signup form declines to create the user. dj-rest-auth never calls that
        policy; its `validate_email` only rejects an address that is already
        *verified*, so the API path let duplicates through.

        Letting them through was not merely untidy. Two unverified rows for one
        address cannot both be verified (allauth's partial unique index permits
        a single verified row per address), so the address became impossible to
        confirm and both accounts were unusable. Anyone could do that to any
        pending signup, with no credentials at all.

        So: hand back the account that already exists instead of making another.
        The caller (`RegisterView.perform_create`) then runs `complete_signup`
        on it, which re-sends a confirmation code to the address. The person who
        controls the mailbox gets what they need to finish. Whoever submitted
        this request learns nothing: the password and business name here are
        discarded, the existing account is untouched, and the response is the
        same 201 an original signup returns.
        """
        pending = self._pending_account(self.validated_data.get('email', ''))
        if pending is not None:
            return pending
        return super().save(request)

    @staticmethod
    def _pending_account(email):
        """The user behind an unverified address, or None.

        An address that is already *verified* never reaches here -- the parent's
        `validate_email` rejects those during `is_valid()`.
        """
        if not email:
            return None
        address = (
            EmailAddress.objects.filter(email__iexact=email, verified=False)
            .order_by('pk')
            .first()
        )
        return address.user if address is not None else None


class VerifyEmailCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=otp.CODE_LENGTH, max_length=otp.CODE_LENGTH)

    def validate(self, attrs):
        try:
            otp.verify(attrs['email'], OTPCode.PURPOSE_VERIFY_EMAIL, attrs['code'])
        except otp.OTPError as exc:
            raise serializers.ValidationError({'code': str(exc)})
        return attrs

    def save(self):
        """Verify exactly one address, through allauth's own guard.

        This used to be a blanket `.update(verified=True)` over every row
        matching the address. Two problems with that. A queryset `update()` is
        raw SQL: it skips `save()`, skips signals, and skips
        `EmailAddress.set_verified()`, which is where allauth checks whether
        another account already holds this address verified. And it targeted
        every matching row rather than one, so with duplicates present it tried
        to create two verified rows for one address and the database's partial
        unique index rejected the write -- an uncaught IntegrityError, a 500,
        and an address nobody could ever confirm.

        Going through the model method instead means a genuine conflict is
        refused politely rather than crashing. `CustomRegisterSerializer.save`
        now prevents the duplicates upstream, so the conflict branch should be
        unreachable for new signups; it stays because rows created before that
        fix still exist, and because a guard that only holds while its caller
        behaves is not a guard.
        """
        address = (
            EmailAddress.objects.filter(email__iexact=self.validated_data['email'])
            .order_by('pk')
            .first()
        )
        if address is None:
            # The code verified against an address with no account behind it.
            # Report it as a bad code rather than confirming that gap exists.
            raise serializers.ValidationError({'code': 'Incorrect or expired code.'})

        if not address.set_verified():
            raise serializers.ValidationError(
                {'email': 'This address is already verified on another account.'}
            )


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self):
        email = self.validated_data['email']
        # Enumeration-safe: silently do nothing if there is no such account.
        if not User.objects.filter(email__iexact=email).exists():
            return
        try:
            code = otp.issue(
                email, OTPCode.PURPOSE_PASSWORD_RESET, enforce_cooldown=True
            )
        except otp.OTPError:
            return  # inside the cooldown window -- stay quiet, response is identical
        otp.send_code_email(email, code, OTPCode.PURPOSE_PASSWORD_RESET)


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=otp.CODE_LENGTH, max_length=otp.CODE_LENGTH)
    new_password1 = serializers.CharField(write_only=True)
    new_password2 = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['new_password1'] != attrs['new_password2']:
            raise serializers.ValidationError(
                {'new_password2': 'Passwords do not match.'}
            )
        try:
            self.user = User.objects.get(email__iexact=attrs['email'])
        except User.DoesNotExist:
            # Don't reveal the account doesn't exist -- look like a bad code.
            raise serializers.ValidationError({'code': 'Incorrect or expired code.'})

        # Cheap, stateless checks first so a weak password never burns a code attempt.
        validate_password(attrs['new_password1'], self.user)
        try:
            otp.verify(attrs['email'], OTPCode.PURPOSE_PASSWORD_RESET, attrs['code'])
        except otp.OTPError as exc:
            raise serializers.ValidationError({'code': str(exc)})
        return attrs

    def save(self):
        self.user.set_password(self.validated_data['new_password1'])
        self.user.save(update_fields=['password'])
        return self.user
