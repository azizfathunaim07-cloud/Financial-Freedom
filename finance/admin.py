from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, Account, Category, Transaction, Budget, SavingsGoal, Allowance


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'can_add', 'can_approve', 'can_view_all')


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Extra', {'fields': ('pin_code', 'role')}),
    )


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'type', 'starting_balance')


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'parent')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('type', 'amount', 'account', 'user', 'date', 'is_approved')
    list_filter = ('type', 'date', 'is_approved')


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'period', 'amount')


@admin.register(SavingsGoal)
class SavingsGoalAdmin(admin.ModelAdmin):
    list_display = ('name', 'target_amount', 'current_amount', 'target_date')


@admin.register(Allowance)
class AllowanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount', 'frequency', 'next_date')
