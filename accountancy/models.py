from django.db import models
from django.urls import reverse
import datetime




class Tasklist(models.Model):
    task = models.CharField(max_length=100, blank=True)
    task_date = models.DateField(auto_now=True)
    task_status = models.BooleanField(default=False)

class DailyMoneyInputs(models.Model):
    id = models.AutoField(primary_key=True)
    UPI = models.IntegerField()
    cash = models.IntegerField()
    cards = models.IntegerField()
    date = models.DateField(default=datetime.date.today, unique=True)
    in_total = models.FloatField(default=0.0)


class Dealers(models.Model):
    party_name = models.CharField(max_length=50, null=False)
    party_slug = models.SlugField(null=False, blank=True, db_index=True)
    GST_num = models.CharField(max_length=15, null=True, blank=True)
    opening_balance = models.FloatField(default=0.0)

    def get_absolute_url(self):
        return reverse("party-details", args=[self.party_slug])
    
    def __str__(self):
        return self.party_name

class Bills(models.Model):
     bill_img = models.ImageField(upload_to='bill_images')
     bill_date = models.DateField(blank=True, null=True)
     dealer_id = models.ForeignKey(Dealers, on_delete=models.CASCADE,null=True, blank=True)
     bill_amount = models.FloatField()
     class Meta:
         verbose_name = 'Bills'

class Payments(models.Model):
    dealer_id = models.ForeignKey(Dealers, on_delete=models.CASCADE, null=False)
    payment_date = models.DateField()
    payment_amount = models.FloatField()
    payment_method = models.CharField(max_length=50)    
    class Meta:
        verbose_name = 'Payments'