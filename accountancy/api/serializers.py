from django.conf import settings
from django.urls import reverse
from rest_framework import serializers

from accountancy.models import Bill, Business, Dealer, Payment, Task


class DealerScopedMixin:
    """For serializers with a `dealer` FK -- reject another tenant's dealer,
    with a message that doesn't confirm it exists elsewhere."""

    def validate_dealer(self, value):
        if value.business_id != self.context["business"].id:
            raise serializers.ValidationError("No such dealer.")
        return value


class DealerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dealer
        fields = [
            "id", "name", "gstin", "opening_balance", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        # Dealer has a DB-level unique(business, name). `business` isn't a field
        # on this serializer, so DRF can't build that check itself -- do it here,
        # using the business the view put into the context.
        business = self.context["business"]
        clash = Dealer.objects.filter(business=business, name=value)
        if self.instance is not None:            # PATCH: ignore the row being edited
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("You already have a dealer with this name.")
        return value


class TaskSerializer(serializers.ModelSerializer):
    title = serializers.CharField(max_length=500)  # model allows blank; the API requires it

    class Meta:
        model = Task
        fields = ["id", "title", "is_done", "created_at"]
        read_only_fields = ["id", "created_at"]


class BillSerializer(DealerScopedMixin, serializers.ModelSerializer):
    image = serializers.FileField(write_only=True)      # upload only -- never echoed back
    file_url = serializers.SerializerMethodField()      # the only way to read the PDF

    class Meta:
        model = Bill
        fields = ["id", "image", "file_url", "date", "dealer", "amount",
                  "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_file_url(self, obj):
        request = self.context["request"]
        return request.build_absolute_uri(reverse("bill-file", kwargs={"pk": obj.pk}))

    def validate_image(self, value):
        max_bytes = getattr(settings, "MAX_BILL_UPLOAD_BYTES", 10 * 1024 * 1024)
        if getattr(value, "content_type", None) != "application/pdf":
            raise serializers.ValidationError("The bill file must be a PDF.")
        if value.size > max_bytes:
            raise serializers.ValidationError("The PDF is too large.")
        return value


class PaymentSerializer(DealerScopedMixin, serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "dealer", "date", "amount", "method", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ["id", "name", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
