import django_filters
from django_filters import CharFilter, DateFilter
from .models import Dealer, Bill, Payment, Cashbook

class BillFilter(django_filters.FilterSet):
    amount = django_filters.NumberFilter(field_name='amount',lookup_expr='gte' )
    start_date = DateFilter(field_name='date', lookup_expr='gte')
    end_date = DateFilter(field_name='date', lookup_expr='lte')
    class Meta:
        model = Bill
        fields = '__all__'
        exclude = ['image']
