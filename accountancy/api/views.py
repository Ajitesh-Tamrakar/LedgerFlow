from django_filters.rest_framework import DjangoFilterBackend

from accountancy.api.base import BusinessScopedViewSet
from accountancy.api.filters import DealerFilter
from accountancy.api.serializers import DealerSerializer
from accountancy.models import Dealer


class DealerViewSet(BusinessScopedViewSet):
    queryset = Dealer.objects.all()
    serializer_class = DealerSerializer
    filterset_class = DealerFilter
    filter_backends = [DjangoFilterBackend]
