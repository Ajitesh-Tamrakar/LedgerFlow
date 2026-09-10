from django.urls import path
from rest_framework.routers import DefaultRouter

from accountancy.api.views import (
    BillViewSet, BusinessView, DealerViewSet, PaymentViewSet, TaskViewSet,
)

router = DefaultRouter()
router.register("dealers", DealerViewSet, basename="dealer")
router.register("tasks", TaskViewSet, basename="task")
router.register("bills", BillViewSet, basename="bill")
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = router.urls + [
    path("business/", BusinessView.as_view(), name="business"),
]
