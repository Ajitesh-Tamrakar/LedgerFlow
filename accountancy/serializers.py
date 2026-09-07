from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers

from accountancy.models import Business


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
