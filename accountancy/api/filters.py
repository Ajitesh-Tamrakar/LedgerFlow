import django_filters
from django.db.models import Q

from accountancy.models import Dealer


class DealerFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = Dealer
        fields = ["is_active"]

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(name__icontains=value) | Q(gstin__icontains=value)
        )
