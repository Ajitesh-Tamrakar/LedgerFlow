import django_filters
from django.db.models import Q

from accountancy.models import Bill, Cashbook, Dealer, Payment


class DealerFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = Dealer
        fields = ["is_active"]

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(name__icontains=value) | Q(gstin__icontains=value)
        )


class BillFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Bill
        fields = ["dealer"]        # auto -> ?dealer=<id> exact match


class PaymentFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Payment
        fields = ["dealer", "method"]      # ?dealer=<id>, ?method=upi (ChoiceFilter from the enum)


class CashbookFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Cashbook
        fields = []       # only the two explicit date filters
