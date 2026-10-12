from django.urls import path, register_converter
from rest_framework.routers import DefaultRouter

from accountancy.api.converters import DateConverter
from accountancy.api.views import (
    BillPurchasesView, BillViewSet, BusinessView, CashbookByDateView, CashbookListView,
    CollectionTrendView, DashboardSummaryView, DealerViewSet, PaymentViewSet, TaskViewSet,
)

register_converter(DateConverter, "date")

router = DefaultRouter()
router.register("dealers", DealerViewSet, basename="dealer")
router.register("tasks", TaskViewSet, basename="task")
router.register("bills", BillViewSet, basename="bill")
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = [
    # This exact path must sit BEFORE the router: the router's bills/{pk}/
    # detail regex ([^/.]+) would otherwise swallow "purchases" and hand it
    # to the CRUD viewset as an (invalid) id.
    path("bills/purchases/", BillPurchasesView.as_view(), name="bill-purchases"),
] + router.urls + [
    path("business/", BusinessView.as_view(), name="business"),
    path("cashbook/", CashbookListView.as_view(), name="cashbook-list"),
    path("cashbook/by-date/<date:date>/", CashbookByDateView.as_view(), name="cashbook-by-date"),
    path("collection-trend/", CollectionTrendView.as_view(), name="collection-trend"),
    path("dashboard-summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
]
