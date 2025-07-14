import django_filters 
from django_filters import CharFilter, DateFilter
from .models import Dealers, Bills, Payments, DailyMoneyInputs

class BillFilter(django_filters.FilterSet):
    amount = django_filters.NumberFilter(field_name='bill_amount',lookup_expr='gte' )
    start_date = DateFilter(field_name='bill_date', lookup_expr='gte')
    end_date = DateFilter(field_name='bill_date', lookup_expr='lte')
    class Meta:
        model = Bills
        fields = '__all__'
        exclude = ['bill_img']