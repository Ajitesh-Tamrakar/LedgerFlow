from django.contrib import admin
from .models import Task, Dealer, Payment, Bill, Cashbook
# Register your models here.

class DailyEntry(admin.ModelAdmin):
    list_display = ('date', 'upi', 'cash', 'cards', 'total')

class OrderEntries(admin.ModelAdmin):
    list_display = ('id', 'title', 'is_done', 'created_at')

class PartyDetails(admin.ModelAdmin):
    list_display = ('id', 'name', 'gstin', 'opening_balance')

class Bill_data(admin.ModelAdmin):
    list_display = ('dealer', 'amount', 'date', 'image' )
class PaymentsView(admin.ModelAdmin):
    list_display = ('pk', 'dealer', 'amount', 'date', 'method')

admin.site.register(Cashbook, DailyEntry)
admin.site.register(Task, OrderEntries)
admin.site.register(Dealer, PartyDetails)
admin.site.register(Bill, Bill_data)
admin.site.register(Payment, PaymentsView)
