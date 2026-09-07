from django.db import models
from django.contrib.auth.models import AbstractUser


class Role(models.Model):
    name = models.CharField(max_length=50)
    can_add = models.BooleanField(default=True)
    can_approve = models.BooleanField(default=False)
    can_view_all = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class User(AbstractUser):
    pin_code = models.CharField(max_length=4, blank=True, null=True)
    role = models.ForeignKey(Role, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return self.get_full_name() or self.username


class Account(models.Model):
    TYPE_CHOICES = [
        ('cash', 'Cash'),
        ('bank', 'Bank'),
        ('e_wallet', 'E-Wallet'),
    ]
    name = models.CharField(max_length=120)
    owner = models.ForeignKey('finance.User', null=True, blank=True, on_delete=models.SET_NULL)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='cash')
    currency = models.CharField(max_length=10, default='IDR')
    starting_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.name} ({self.currency})"


class Category(models.Model):
    TYPE_CHOICES = [
        ('income', 'Income'),
        ('expense', 'Expense'),
        ('transfer', 'Transfer'),
    ]
    name = models.CharField(max_length=120)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return self.name


class Transaction(models.Model):
    TYPE_CHOICES = [
        ('income', 'Income'),
        ('expense', 'Expense'),
        ('transfer', 'Transfer'),
    ]
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='transactions')
    user = models.ForeignKey('finance.User', on_delete=models.SET_NULL, null=True, blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=10, default='IDR')
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL)
    date = models.DateTimeField()
    description = models.TextField(blank=True)
    related_account = models.ForeignKey(Account, null=True, blank=True, on_delete=models.SET_NULL, related_name='related_transactions')
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey('finance.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='approved_transactions')
    recurring_rule = models.CharField(max_length=200, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['account', 'date']),
            models.Index(fields=['user', 'date']),
        ]

    def __str__(self):
        return f"{self.type} {self.amount} on {self.date.date()}"


class Budget(models.Model):
    PERIOD_CHOICES = [
        ('monthly', 'Monthly'),
        ('weekly', 'Weekly'),
        ('yearly', 'Yearly'),
    ]
    name = models.CharField(max_length=150, blank=True)
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL)
    period = models.CharField(max_length=20, choices=PERIOD_CHOICES, default='monthly')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.name or f"Budget {self.pk}"


class SavingsGoal(models.Model):
    name = models.CharField(max_length=150)
    target_amount = models.DecimalField(max_digits=14, decimal_places=2)
    current_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    target_date = models.DateField(null=True, blank=True)
    account = models.ForeignKey('finance.Account', null=True, blank=True, on_delete=models.SET_NULL, related_name='savings_goals')
    owner = models.ForeignKey('finance.User', null=True, blank=True, on_delete=models.SET_NULL)

    def remaining(self):
        return max(self.target_amount - self.current_amount, 0)

    def __str__(self):
        return f"{self.name} ({self.account or 'Tanpa rekening'})"


class Allowance(models.Model):
    user = models.ForeignKey('finance.User', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    FREQUENCY = [('monthly', 'Monthly'), ('weekly', 'Weekly')]
    frequency = models.CharField(max_length=20, choices=FREQUENCY, default='monthly')
    next_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Allowance {self.user} {self.amount} ({self.frequency})"


# --- Asset management models (MVP manual entry) ---
class AssetCategory(models.Model):
    user = models.ForeignKey('finance.User', null=True, blank=True, on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    color = models.CharField(max_length=20, blank=True, default='')
    icon = models.CharField(max_length=64, blank=True, default='')
    is_default = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Asset Category'
        verbose_name_plural = 'Asset Categories'

    def __str__(self):
        return self.name


class Asset(models.Model):
    STATUS_CHOICES = [
        ('active', 'Aktif'),
        ('sold', 'Dijual'),
        ('depreciated', 'Disusutkan'),
        ('donated', 'Dihibahkan'),
    ]

    owner = models.ForeignKey('finance.User', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(AssetCategory, null=True, blank=True, on_delete=models.SET_NULL)
    description = models.TextField(blank=True)
    acquisition_date = models.DateField(null=True, blank=True)
    acquisition_value = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    current_value = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='active')
    currency = models.CharField(max_length=10, default='IDR')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-current_value', 'name']

    def __str__(self):
        return f"{self.name} ({self.owner})"


class AssetValueHistory(models.Model):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='value_history')
    old_value = models.DecimalField(max_digits=18, decimal_places=2)
    new_value = models.DecimalField(max_digits=18, decimal_places=2)
    changed_at = models.DateTimeField(auto_now_add=True)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-changed_at']

    def __str__(self):
        return f"{self.asset.name}: {self.old_value} -> {self.new_value} on {self.changed_at.date()}"


class AssetLiability(models.Model):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='liabilities')
    name = models.CharField(max_length=200)
    outstanding_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.asset.name})"
