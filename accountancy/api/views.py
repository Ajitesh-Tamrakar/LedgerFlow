from accountancy.api.base import BusinessScopedViewSet
from accountancy.api.filters import DealerFilter
from accountancy.api.serializers import DealerSerializer, TaskSerializer
from accountancy.models import Dealer, Task


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
