from django.http import FileResponse, Http404
from rest_framework.decorators import action
from rest_framework.generics import GenericAPIView, ListAPIView, RetrieveUpdateAPIView
from rest_framework.response import Response

from accountancy.api.base import BusinessScopedMixin, BusinessScopedViewSet
from accountancy.api.filters import BillFilter, CashbookFilter, DealerFilter, PaymentFilter
from accountancy.api.serializers import (
    BillSerializer, BusinessSerializer, CashbookSerializer, DealerSerializer,
    PaymentSerializer, TaskSerializer,
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
