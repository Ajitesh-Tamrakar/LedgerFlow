from allauth.account.models import EmailAddress
from dj_rest_auth.registration.serializers import RegisterSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accountancy import otp
from accountancy.models import Business, OTPCode

User = get_user_model()


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
        EmailAddress.objects.filter(
            email__iexact=self.validated_data['email']
        ).update(verified=True)


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
