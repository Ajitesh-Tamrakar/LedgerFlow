from django.http import FileResponse
from rest_framework.decorators import action
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.response import Response

from accountancy.api.base import BusinessScopedMixin, BusinessScopedViewSet
from accountancy.api.filters import BillFilter, DealerFilter, PaymentFilter
from accountancy.api.serializers import (
    BillSerializer, BusinessSerializer, DealerSerializer, PaymentSerializer, TaskSerializer,
)
from accountancy.models import Bill, Dealer, Payment, Task


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
