from django.contrib import admin
from .models import  Tasklist,Dealers, Payments, Bills, DailyMoneyInputs
# Register your models here.

class DailyEntry(admin.ModelAdmin):
    list_display = ('date', 'UPI', 'cash', 'cards', 'in_total')

class OrderEntries(admin.ModelAdmin):
    list_display = ('id', 'task', 'task_status', 'task_date')

class PartyDetails(admin.ModelAdmin):
    list_display = ('id', 'party_name', 'GST_num', 'opening_balance')

class Bill_data(admin.ModelAdmin):
    list_display = ('dealer_id', 'bill_amount', 'bill_date', 'bill_img' )
class PaymentsView(admin.ModelAdmin):
    list_display = ('pk', 'dealer_id', 'payment_amount', 'payment_date', 'payment_method')
    
admin.site.register(DailyMoneyInputs, DailyEntry)
admin.site.register(Tasklist, OrderEntries)
admin.site.register(Dealers, PartyDetails)
admin.site.register(Bills, Bill_data)
admin.site.register(Payments, PaymentsView)