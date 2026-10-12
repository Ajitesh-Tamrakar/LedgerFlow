import io
import os

from django.conf import settings
from django.core.files.base import ContentFile
from django.urls import reverse
from PIL import Image
from rest_framework import serializers

from accountancy.models import Bill, Business, Cashbook, Dealer, Payment, Task

# The page formats the upload accepts, and the one that looks like an image
# but Pillow can't decode (HEIC/HEIF need an extra dependency the project
# deliberately doesn't take). Checked by content type first, extension as the
# fallback (browsers are unreliable about HEIC types).
ACCEPTED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
ACCEPTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
UNREADABLE_IMAGE_TYPES = {"image/heic", "image/heif", "application/heic", "application/heif"}
UNREADABLE_IMAGE_EXTENSIONS = {".heic", ".heif"}
ACCEPTED_FORMATS_NOTE = "Accepted formats: a PDF, or JPG, JPEG, PNG or WEBP pages."


class DealerScopedMixin:
    """For serializers with a `dealer` FK -- reject another tenant's dealer,
    with a message that doesn't confirm it exists elsewhere."""

    def validate_dealer(self, value):
        if value.business_id != self.context["business"].id: #type: ignore
            raise serializers.ValidationError("No such dealer.")
        return value


class DealerSerializer(serializers.ModelSerializer):
    # Computed, not stored: opening balance + everything billed to this
    # dealer - everything paid to them, all time. The viewset's queryset
    # annotation supplies it (one SQL pass); it is declared here only so
    # the response carries a proper string money value. Never an input.
    outstanding_balance = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = Dealer
        fields = [
            "id", "name", "gstin", "opening_balance", "outstanding_balance",
            "is_active", "created_at", "updated_at",
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


def _page_kind(file):
    """Which bucket a page upload falls in. Content type first, extension as
    the fallback -- browsers are unreliable about HEIC types, but the filename
    always tells the truth."""
    content_type = (getattr(file, "content_type", "") or "").lower()
    extension = os.path.splitext(file.name)[1].lower()
    if content_type in UNREADABLE_IMAGE_TYPES or extension in UNREADABLE_IMAGE_EXTENSIONS:
        return "unreadable"
    if content_type in ACCEPTED_IMAGE_TYPES or extension in ACCEPTED_IMAGE_EXTENSIONS:
        return "accepted"
    return "other"


class BillSerializer(DealerScopedMixin, serializers.ModelSerializer):
    # --- inputs (write-only, never echoed back) ---
    # The two mutually exclusive file sources: a PDF you already have, or
    # photo pages LedgerFlow compiles into one PDF. The photos travel as
    # repeated multipart parts under `images` (the browser's FormData does
    # that naturally; DRF's ListField collects them).
    image = serializers.FileField(required=False, write_only=True)
    images = serializers.ListField(
        child=serializers.FileField(), required=False, write_only=True, allow_empty=False
    )

    # --- outputs ---
    file_url = serializers.SerializerMethodField()      # the only way to read the PDF
    file_size = serializers.SerializerMethodField()     # bytes on disk, for the "2.4 MB" meta
    dealer_name = serializers.CharField(source="dealer.name", read_only=True)  # name for lists
    dealer_active = serializers.BooleanField(source="dealer.is_active", read_only=True)
    # Derived, never a client input: validate() always discards whatever
    # arrives and re-sets it from the file source (see below) -- writable
    # only so the re-set value can be persisted.
    pages = serializers.IntegerField(allow_null=True, required=False)

    # The model's floor is >= 0 (data written outside the API); the API's
    # own floor is strictly greater -- a zero-amount bill is meaningless, and
    # the detail screen shows the rejection.
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)

    class Meta:
        model = Bill
        fields = ["id", "image", "images", "file_url", "file_size", "pages",
                  "date", "dealer", "dealer_name", "dealer_active", "amount",
                  "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_file_url(self, obj):
        request = self.context["request"]
        return request.build_absolute_uri(reverse("bill-file", kwargs={"pk": obj.pk}))

    def get_file_size(self, obj):
        # One filesystem stat per row; a missing file reads null, not 0
        # (missing is not zero).
        try:
            return obj.image.size
        except (OSError, ValueError):
            return None

    def validate_image(self, value):
        max_bytes = getattr(settings, "MAX_BILL_UPLOAD_BYTES", 10 * 1024 * 1024)
        if getattr(value, "content_type", None) != "application/pdf":
            raise serializers.ValidationError("The bill file must be a PDF.")
        if value.size > max_bytes:
            raise serializers.ValidationError("The PDF is too large.")
        return value

    def validate_images(self, value):
        max_bytes = getattr(settings, "MAX_BILL_UPLOAD_BYTES", 10 * 1024 * 1024)
        total = 0
        for file in value:
            kind = _page_kind(file)
            if kind == "unreadable":
                raise serializers.ValidationError(
                    f"'{file.name}' is a HEIC/HEIF file, which the server can't read. "
                    f"Please upload in an accepted format. {ACCEPTED_FORMATS_NOTE}"
                )
            if kind != "accepted":
                raise serializers.ValidationError(
                    f"'{file.name}' can't be used as a page. {ACCEPTED_FORMATS_NOTE}"
                )
            total += file.size
            # A real readability check, not just a type check: a renamed or
            # corrupt file fails here, before anything is stored.
            try:
                with Image.open(file) as img:
                    img.verify()
            except Exception:
                raise serializers.ValidationError(
                    f"'{file.name}' can't be read as an image -- it appears to be corrupt."
                )
        if total > max_bytes:
            raise serializers.ValidationError("The pages together are too large.")
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Amount is required and must be greater than zero."
            )
        return value

    def _compile_images(self, files):
        """The photo pages, in the order the user arranged them, as one PDF.
        Pillow is already a project dependency, so no new library for this."""
        opened = []
        for file in files:
            file.seek(0)
            img = Image.open(io.BytesIO(file.read()))
            if img.mode in ("RGBA", "LA"):
                # PDF can't hold alpha; flatten onto white.
                white = Image.new("RGB", img.size, (255, 255, 255))
                white.paste(img, mask=img.getchannel("A"))
                img = white
            elif img.mode not in ("1", "L", "RGB", "CMYK"):
                img = img.convert("RGB")
            opened.append(img)
        buffer = io.BytesIO()
        opened[0].save(buffer, format="PDF", save_all=True, append_images=opened[1:])
        buffer.seek(0)
        return ContentFile(buffer.read(), name="compiled-bill.pdf")

    def validate(self, attrs):
        if "image" in attrs and "images" in attrs:
            raise serializers.ValidationError(
                "A bill takes one file source -- the PDF, or the photo pages. Not both."
            )
        if self.instance is None and "image" not in attrs and "images" not in attrs:
            raise serializers.ValidationError(
                {"image": "A bill needs its file -- a PDF, or photo pages to compile into one."}
            )
        if "images" in attrs:
            pages = attrs.pop("images")
            attrs["image"] = self._compile_images(pages)
            attrs["pages"] = len(pages)   # known: one page per photo
        elif "image" in attrs:
            attrs["pages"] = None         # a dropped-in PDF: the server can't count it
        else:
            attrs.pop("pages", None)      # metadata-only correction: pages never travels alone
        return attrs


class PaymentSerializer(DealerScopedMixin, serializers.ModelSerializer):
    dealer_name = serializers.CharField(source="dealer.name", read_only=True)  # name for lists

    # The model's floor is >= 0 (data written outside the API); the API's
    # own floor is strictly greater -- a zero-amount payment is meaningless,
    # and the detail screen shows the rejection (the BillSerializer guard).
    # required=True on the re-declaration: the model carries a 0.00 default
    # that would otherwise make the field optional on create. (PATCH stays
    # partial -- DRF relaxes `required` there -- but an amount that DOES
    # travel must still be > 0.)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Amount is required and must be greater than zero."
            )
        return value

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


# The Bills page's "Purchases this month" headline and its per-dealer
# breakdown in one document. The design is explicit that these figures come
# from their own endpoint, never summed from the (paginated, filtered) list
# -- one grouped SQL sum per dealer over the period instead.
# max_digits=14: the same widening rationale as the dashboard summaries.

class DealerPurchasesSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    total = serializers.DecimalField(max_digits=14, decimal_places=2)


class BillPurchasesSerializer(serializers.Serializer):
    period = serializers.ChoiceField(choices=["week", "month", "quarter"])
    label = serializers.CharField()
    start = serializers.DateField()
    end = serializers.DateField()
    total = serializers.DecimalField(max_digits=14, decimal_places=2)
    count = serializers.IntegerField()
    dealers = DealerPurchasesSerializer(many=True)
