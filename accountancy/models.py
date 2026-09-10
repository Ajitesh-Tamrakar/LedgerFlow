from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q
from simple_history.models import HistoricalRecords


class Business(models.Model):
    name = models.CharField(max_length=100)
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='business')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    def __str__(self):
        return self.name


class Dealer(models.Model):
    name = models.CharField(max_length=100)
    gstin = models.CharField(max_length=15, null=True, blank=True)
    opening_balance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    is_active = models.BooleanField(default=True)
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['business', 'name'], name='unique_dealer_name_per_business'),
        ]

    def __str__(self):
        return self.name


class Bill(models.Model):
    image = models.FileField(upload_to='bill_images')
    date = models.DateField()
    dealer = models.ForeignKey(Dealer, on_delete=models.PROTECT)
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        indexes = [models.Index(fields=['business', 'dealer', 'date'])]
        constraints = [
            models.CheckConstraint(check=Q(amount__gte=0), name='bill_amount_gte_0'),
        ]


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH = 'cash', 'Cash'
        UPI = 'upi', 'UPI'
        CARD = 'card', 'Card'
        CHEQUE = 'cheque', 'Cheque'
        BANK_TRANSFER = 'bank_transfer', 'Bank transfer'

    dealer = models.ForeignKey(Dealer, on_delete=models.PROTECT)
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    date = models.DateField()
    amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    method = models.CharField(max_length=20, choices=Method.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        indexes = [models.Index(fields=['business', 'dealer', 'date'])]
        constraints = [
            models.CheckConstraint(check=Q(amount__gte=0), name='payment_amount_gte_0'),
            # keep the value list in sync with Method above -- Meta can't see the nested class
            models.CheckConstraint(
                check=Q(method__in=['cash', 'upi', 'card', 'cheque', 'bank_transfer']),
                name='payment_method_valid',
            ),
        ]


class Cashbook(models.Model):
    upi = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    cash = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    cards = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    date = models.DateField()
    total = models.GeneratedField(
        expression=F('upi') + F('cash') + F('cards'),
        output_field=models.DecimalField(max_digits=10, decimal_places=2),
        db_persist=True,
    )
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['business', 'date'], name='unique_cashbook_date_per_business'),
            models.CheckConstraint(check=Q(upi__gte=0), name='cashbook_upi_gte_0'),
            models.CheckConstraint(check=Q(cash__gte=0), name='cashbook_cash_gte_0'),
            models.CheckConstraint(check=Q(cards__gte=0), name='cashbook_cards_gte_0'),
        ]


class Task(models.Model):
    title = models.TextField(max_length=500, blank=True)
    created_at = models.DateField(auto_now_add=True)
    is_done = models.BooleanField(default=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE)


# --- Auth support (not part of the ledger domain schema) ---------------------
# Stateless one-time codes for email verification and password reset. This is
# the DB-row equivalent of what allauth's by-code flow keeps in request.session
# -- we don't use that flow because it needs a session cookie the API clients
# don't carry. No django-simple-history: transient, non-financial.

class OTPCode(models.Model):
    PURPOSE_VERIFY_EMAIL = 'verify_email'
    PURPOSE_PASSWORD_RESET = 'password_reset'
    PURPOSE_CHOICES = [
        (PURPOSE_VERIFY_EMAIL, 'Email verification'),
        (PURPOSE_PASSWORD_RESET, 'Password reset'),
    ]

    email = models.EmailField()
    code_hash = models.CharField(max_length=64)  # HMAC-SHA256 hex digest, never the plaintext
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempt_count = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['email', 'purpose'])]

    def __str__(self):
        return f'{self.get_purpose_display()} code for {self.email}'
