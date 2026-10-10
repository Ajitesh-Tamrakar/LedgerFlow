from django.conf import settings
from django.urls import reverse
from rest_framework import serializers

from accountancy.models import Bill, Business, Cashbook, Dealer, Payment, Task


class DealerScopedMixin:
    """For serializers with a `dealer` FK -- reject another tenant's dealer,
    with a message that doesn't confirm it exists elsewhere."""

    def validate_dealer(self, value):
        if value.business_id != self.context["business"].id: #type: ignore
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
    dealer_name = serializers.CharField(source="dealer.name", read_only=True)  # name for lists

    class Meta:
        model = Bill
        fields = ["id", "image", "file_url", "date", "dealer", "dealer_name", "amount",
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
    dealer_name = serializers.CharField(source="dealer.name", read_only=True)  # name for lists

    class Meta:
        model = Payment
        fields = ["id", "dealer", "dealer_name", "date", "amount", "method", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ["id", "name", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class CashbookSerializer(serializers.ModelSerializer):
    # DRF has no mapping for a GeneratedField -- declare it so it's a proper
    # read-only DecimalField (string-coerced output, like the other money fields).
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Cashbook
        fields = ["id", "date", "upi", "cash", "cards", "total",
                  "created_at", "updated_at"]
        # date comes from the URL on PUT (injected by the view); total is the DB
        # GeneratedField -- both read-only, never accepted from the body.
        read_only_fields = ["id", "date", "created_at", "updated_at"]


# --- Computed summaries (no model behind them) ----------------------------------
# Plain Serializers, not ModelSerializer: the view builds every value itself, so
# there is no model row to map. These just pin the response shape.
# max_digits=14: a single Cashbook total is capped at 10 digits, but a headline
# total sums up to a whole quarter of rows, so widen the display.

class PeriodSummarySerializer(serializers.Serializer):
    label = serializers.CharField()       # "October" / "Wk of 5 Oct" / "Q4 2026"
    start = serializers.DateField()
    end = serializers.DateField()
    total = serializers.DecimalField(max_digits=14, decimal_places=2)


class TrendPointSerializer(serializers.Serializer):
    bucket = serializers.DateField()      # ISO -- the bucket's day (or its Monday)
    label = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)


class CollectionTrendSerializer(serializers.Serializer):
    period = serializers.ChoiceField(choices=["week", "month", "quarter"])
    granularity = serializers.ChoiceField(choices=["day", "week"])
    current = PeriodSummarySerializer()
    previous = PeriodSummarySerializer()
    change_percent = serializers.FloatField(allow_null=True)  # null when previous was 0
    trend = TrendPointSerializer(many=True)


# The dashboard's five summary cards in one tray. The view does the adding;
# these just pin the names and types of the numbers it hands back.
# (max_digits=14: same widening rationale as PeriodSummarySerializer.)

class InProgressSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=14, decimal_places=2)
    elapsed_days = serializers.IntegerField()
    period_days = serializers.IntegerField()
    pace_delta_percent = serializers.FloatField(allow_null=True)  # null when the baseline was 0
    prev_same_days_total = serializers.DecimalField(max_digits=14, decimal_places=2)


class NetCashFlowSerializer(serializers.Serializer):
    collected = serializers.DecimalField(max_digits=14, decimal_places=2)
    paid = serializers.DecimalField(max_digits=14, decimal_places=2)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)


class PurchasingSerializer(serializers.Serializer):
    bills = serializers.DecimalField(max_digits=14, decimal_places=2)
    bill_count = serializers.IntegerField()
    payments = serializers.DecimalField(max_digits=14, decimal_places=2)
    payment_count = serializers.IntegerField()


class DealerBalanceSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    gstin = serializers.CharField(allow_null=True)
    balance = serializers.DecimalField(max_digits=14, decimal_places=2)


class OutstandingSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=14, decimal_places=2)
    dealer_count = serializers.IntegerField()
    owed = serializers.DecimalField(max_digits=14, decimal_places=2)
    credit = serializers.DecimalField(max_digits=14, decimal_places=2)
    dealers = DealerBalanceSerializer(many=True)


class DashboardSummarySerializer(serializers.Serializer):
    period = serializers.ChoiceField(choices=["week", "month", "quarter"])
    in_progress = InProgressSerializer()
    net_cash_flow = NetCashFlowSerializer()
    purchasing = PurchasingSerializer()
    outstanding = OutstandingSerializer()
