from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import TruncDay, TruncWeek
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import GenericAPIView, ListAPIView, RetrieveUpdateAPIView
from rest_framework.response import Response

from accountancy.api.base import BusinessScopedMixin, BusinessScopedViewSet
from accountancy.api.filters import BillFilter, CashbookFilter, DealerFilter, PaymentFilter
from accountancy.api.serializers import (
    BillSerializer, BusinessSerializer, CashbookSerializer, CollectionTrendSerializer,
    DashboardSummarySerializer, DealerSerializer, PaymentSerializer, TaskSerializer,
)
from accountancy.models import Bill, Cashbook, Dealer, Payment, Task


class DealerViewSet(BusinessScopedViewSet):
    queryset = Dealer.objects.all()
    serializer_class = DealerSerializer
    filterset_class = DealerFilter
    ordering = ["name"]  # default sort when ?ordering= is absent (pagination needs one)
    ordering_fields = ["name", "created_at", "updated_at"]


class TaskViewSet(BusinessScopedViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]  # DELETE back on
    ordering = ["-created_at", "-id"]  # created_at is a DateField -> -id breaks same-day ties
    ordering_fields = ["created_at", "is_done"]


class BillViewSet(BusinessScopedViewSet):
    queryset = Bill.objects.all()
    serializer_class = BillSerializer
    filterset_class = BillFilter
    ordering = ["-date", "-id"]
    ordering_fields = ["date", "amount", "created_at"]

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        bill = self.get_object()  # scoped + 404 through the base
        return FileResponse(
            bill.image.open("rb"),
            as_attachment="download" in request.query_params,
            filename=f"bill-{bill.date}.pdf",
            content_type="application/pdf",
        )


class PaymentViewSet(BusinessScopedViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    filterset_class = PaymentFilter
    ordering = ["-date", "-id"]
    ordering_fields = ["date", "amount", "created_at"]

    @action(detail=False, methods=["get"])
    def methods(self, request):
        return Response([{"value": v, "label": l} for v, l in Payment.Method.choices])


class BusinessView(BusinessScopedMixin, RetrieveUpdateAPIView):
    """Singleton -- GET/PATCH /api/business/, no {id}. Uses the mixin (permission
    pair + context), not the ViewSet (there's nothing to list or create)."""

    serializer_class = BusinessSerializer
    http_method_names = ["get", "patch", "head", "options"]  # no PUT

    def get_object(self):
        return self.request.user.business


class CashbookListView(BusinessScopedMixin, ListAPIView):
    serializer_class = CashbookSerializer
    filterset_class = CashbookFilter
    ordering = ["-date", "-id"]
    ordering_fields = ["date", "total"]

    def get_queryset(self):  # the mixin has no get_queryset -- scope here
        return Cashbook.objects.filter(business=self.business)


class CashbookByDateView(BusinessScopedMixin, GenericAPIView):
    """Addressed by date, not id. PUT is create-or-replace (idempotent);
    GET and DELETE 404 on a day with no entry. No POST, no PATCH."""

    serializer_class = CashbookSerializer
    http_method_names = ["get", "put", "delete", "head", "options"]

    def _row(self):
        return Cashbook.objects.filter(
            business=self.business, date=self.kwargs["date"]
        ).first()

    def get(self, request, date):
        row = self._row()
        if row is None:
            raise Http404
        return Response(self.get_serializer(row).data)

    def put(self, request, date):
        row = self._row()
        serializer = self.get_serializer(row, data=request.data)  # row=None -> create
        serializer.is_valid(raise_exception=True)
        serializer.save(business=self.business, date=date)
        # GeneratedField `total` is recomputed by the DB but not refreshed in
        # memory on UPDATE -- pull it back before serializing the response.
        serializer.instance.refresh_from_db(fields=["total"])
        return Response(serializer.data, status=200 if row else 201)

    def delete(self, request, date):
        row = self._row()
        if row is None:
            raise Http404
        row.delete()
        return Response(status=204)


# --- Computed summaries ----------------------------------------------------------


def _period_bounds(period, ref):
    """(start, end, label) of the calendar period that contains `ref`, both
    bounds inclusive. Periods are calendar-aligned, so "the previous period"
    is simply the one containing the day before this one starts."""
    if period == "week":
        start = ref - timedelta(days=ref.weekday())  # Monday anchor, matches TruncWeek
        return start, start + timedelta(days=6), f"Wk of {start.day} {start:%b}"
    if period == "month":
        start = ref.replace(day=1)
        last_day = monthrange(start.year, start.month)[1]
        return start, start.replace(day=last_day), start.strftime("%B")
    quarter = (ref.month - 1) // 3
    first_month = quarter * 3 + 1
    start = date(ref.year, first_month, 1)
    last_month = first_month + 2
    end = date(start.year, last_month, monthrange(start.year, last_month)[1])
    return start, end, f"Q{quarter + 1} {start.year}"


def _bucket_dates(start, end, period):
    """Every bucket the graph must show, gaps included.

    Week and month bucket by day; a quarter buckets by week -- 90+ daily
    points would make the chart unreadable. Bucket boundaries are what
    TruncDay/TruncWeek produce, so this list lines up 1:1 with the sums."""
    if period == "quarter":
        first_monday = start - timedelta(days=start.weekday())
        count = (end - first_monday).days // 7 + 1
        return [first_monday + timedelta(weeks=i) for i in range(count)]
    count = (end - start).days + 1
    return [start + timedelta(days=i) for i in range(count)]


class CollectionTrendView(BusinessScopedMixin, GenericAPIView):
    """GET /api/collection-trend/?period=week|month|quarter

    A computed summary, not a collection: no model and no viewset on the
    router -- it reads Cashbook and returns one aggregated document. Same
    shape as BusinessView / CashbookByDateView: the mixin for auth + scoping,
    a plain class view on a path(). `period` is a query param, like the
    ?date_from= filters, because it changes the calculation.
    """

    serializer_class = CollectionTrendSerializer
    http_method_names = ["get", "head", "options"]
    PERIODS = ("week", "month", "quarter")

    def _today(self):
        return timezone.localdate()

    def _bucket_totals(self, start, end, period):
        trunc = TruncWeek if period == "quarter" else TruncDay
        rows = (
            Cashbook.objects.filter(business=self.business, date__gte=start, date__lte=end)
            .annotate(bucket=trunc("date"))
            .values("bucket")
            .annotate(amount=Sum("total"))
        )
        return {row["bucket"]: row["amount"] for row in rows}

    def get(self, request):
        period = request.query_params.get("period", "month").lower()
        if period not in self.PERIODS:
            raise ValidationError({"period": f"Choose from: {', '.join(self.PERIODS)}."})

        cur_start, cur_end, cur_label = _period_bounds(period, self._today())
        prev_start, prev_end, prev_label = _period_bounds(period, cur_start - timedelta(days=1))

        cur_totals = self._bucket_totals(cur_start, cur_end, period)
        prev_total = sum(self._bucket_totals(prev_start, prev_end, period).values(), Decimal("0.00"))

        zero = Decimal("0.00")
        trend = [
            {
                "bucket": bucket,
                "label": f"Wk of {bucket.day} {bucket:%b}" if period == "quarter" else f"{bucket.day} {bucket:%b}",
                # days with no cashbook entry read 0, and so do the not-yet-reached
                # days of the running period -- the axis stays full and comparable
                "amount": cur_totals.get(bucket, zero),
            }
            for bucket in _bucket_dates(cur_start, cur_end, period)
        ]
        cur_total = sum((point["amount"] for point in trend), zero)

        if prev_total:
            change = float(((cur_total - prev_total) / prev_total * 100).quantize(Decimal("0.01")))
        else:
            change = None  # no baseline to compare against

        data = {
            "period": period,
            "granularity": "week" if period == "quarter" else "day",
            "current": {"label": cur_label, "start": cur_start, "end": cur_end, "total": cur_total},
            "previous": {"label": prev_label, "start": prev_start, "end": prev_end, "total": prev_total},
            "change_percent": change,
            "trend": trend,
        }
        return Response(self.get_serializer(data).data)


class DashboardSummaryView(BusinessScopedMixin, GenericAPIView):
    """GET /api/dashboard-summary/?period=week|month|quarter

    One computed tray feeding the five dashboard summary cards: in progress,
    net cash flow, purchasing activity, total outstanding, outstanding per
    dealer. Same shape as CollectionTrendView -- the mixin for auth +
    scoping, a plain class view on a path() -- because it is a summary, not
    a model collection, so there is nothing for a ViewSet to route.

    in_progress / net_cash_flow / purchasing all read the selected period
    (the same calendar bounds collection-trend uses). outstanding is a
    balance as of today -- it deliberately ignores `period`, so the period
    toggle never moves it.
    """

    serializer_class = DashboardSummarySerializer
    http_method_names = ["get", "head", "options"]
    PERIODS = ("week", "month", "quarter")

    def get(self, request):
        period = request.query_params.get("period", "month").lower()
        if period not in self.PERIODS:
            raise ValidationError({"period": f"Choose from: {', '.join(self.PERIODS)}."})

        today = timezone.localdate()
        zero = Decimal("0.00")

        # The calendar period containing today, and the one before it.
        cur_start, cur_end, _ = _period_bounds(period, today)
        prev_start, prev_end, _ = _period_bounds(period, cur_start - timedelta(days=1))

        cashbook = Cashbook.objects.filter(business=self.business)

        # --- In progress: only the days that have already happened ----------
        # "So far" clips the period at today. Pace compares against the same
        # number of days in the previous period (Sep 14 -> Aug 1-14), clamped
        # to the previous period's end in case it is shorter (Jan vs Feb).
        elapsed = (today - cur_start).days + 1
        span = (cur_end - cur_start).days + 1
        prev_through = min(prev_start + timedelta(days=elapsed - 1), prev_end)
        partial_now = (
            cashbook.filter(date__gte=cur_start, date__lte=today)
            .aggregate(total=Sum("total"))["total"] or zero
        )
        partial_prev = (
            cashbook.filter(date__gte=prev_start, date__lte=prev_through)
            .aggregate(total=Sum("total"))["total"] or zero
        )

        # --- Whole selected period (the same window the trend card reads) ---
        period_cash = cashbook.filter(date__gte=cur_start, date__lte=cur_end)
        collected = period_cash.aggregate(total=Sum("total"))["total"] or zero
        period_payments = Payment.objects.filter(
            business=self.business, date__gte=cur_start, date__lte=cur_end
        )
        paid = period_payments.aggregate(total=Sum("amount"))["total"] or zero
        period_bills = Bill.objects.filter(
            business=self.business, date__gte=cur_start, date__lte=cur_end
        )
        billed = period_bills.aggregate(total=Sum("amount"))["total"] or zero

        if partial_prev:
            pace = float(((partial_now - partial_prev) / partial_prev * 100).quantize(Decimal("0.01")))
        else:
            pace = None  # no baseline to compare against

        # --- Outstanding: balance as of today, independent of the period ----
        # Per dealer: opening balance + everything billed to them -
        # everything paid to them. Positive = still owed to the dealer;
        # negative = the dealer is in credit (overpaid).
        bill_sums = {
            row["dealer_id"]: row["billed"] or zero
            for row in Bill.objects.filter(business=self.business)
            .values("dealer_id").annotate(billed=Sum("amount"))
        }
        pay_sums = {
            row["dealer_id"]: row["paid"] or zero
            for row in Payment.objects.filter(business=self.business)
            .values("dealer_id").annotate(paid=Sum("amount"))
        }
        balances = []
        for dealer in Dealer.objects.filter(business=self.business).order_by("name"):
            balance = (
                dealer.opening_balance
                + bill_sums.get(dealer.id, zero)
                - pay_sums.get(dealer.id, zero)
            )
            if balance:  # a dealer who nets to zero has nothing to show
                balances.append(
                    {"id": dealer.id, "name": dealer.name, "gstin": dealer.gstin, "balance": balance}
                )
        balances.sort(key=lambda row: row["balance"], reverse=True)  # biggest first, credits last

        data = {
            "period": period,
            "in_progress": {
                "total": partial_now,
                "elapsed_days": elapsed,
                "period_days": span,
                "pace_delta_percent": pace,
                "prev_same_days_total": partial_prev,
            },
            "net_cash_flow": {
                "collected": collected,
                "paid": paid,
                "amount": collected - paid,
            },
            "purchasing": {
                "bills": billed,
                "bill_count": period_bills.count(),
                "payments": paid,
                "payment_count": period_payments.count(),
            },
            "outstanding": {
                "total": sum((row["balance"] for row in balances), zero),
                "dealer_count": len(balances),
                "owed": sum((row["balance"] for row in balances if row["balance"] > zero), zero),
                "credit": sum((row["balance"] for row in balances if row["balance"] < zero), zero),
                "dealers": balances,
            },
        }
        return Response(self.get_serializer(data).data)
