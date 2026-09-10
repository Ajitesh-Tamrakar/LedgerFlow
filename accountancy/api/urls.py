from django.urls import path, register_converter
from rest_framework.routers import DefaultRouter

from accountancy.api.converters import DateConverter
from accountancy.api.views import (
    BillViewSet, BusinessView, CashbookByDateView, CashbookListView,
    DealerViewSet, PaymentViewSet, TaskViewSet,
)

register_converter(DateConverter, "date")

router = DefaultRouter()
router.register("dealers", DealerViewSet, basename="dealer")
router.register("tasks", TaskViewSet, basename="task")
router.register("bills", BillViewSet, basename="bill")
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = router.urls + [
    path("business/", BusinessView.as_view(), name="business"),
    path("cashbook/", CashbookListView.as_view(), name="cashbook-list"),
    path("cashbook/by-date/<date:date>/", CashbookByDateView.as_view(), name="cashbook-by-date"),
]
