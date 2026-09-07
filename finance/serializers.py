from rest_framework import serializers
from .models import User, Role, Account, Category, Transaction, Budget, SavingsGoal, Allowance


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'pin_code', 'role']


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = '__all__'


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'


class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = '__all__'


class SavingsGoalSerializer(serializers.ModelSerializer):
    account_name = serializers.SerializerMethodField()

    class Meta:
        model = SavingsGoal
        fields = ['id', 'name', 'target_amount', 'current_amount', 'target_date', 'account', 'account_name', 'owner']
        read_only_fields = ['owner', 'account_name']

    def get_account_name(self, obj):
        return obj.account.name if obj.account else None


class AllowanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allowance
        fields = '__all__'


# --- Asset serializers (merged from asset_serializers) ---
from .models import Asset, AssetCategory, AssetValueHistory, AssetLiability


class AssetCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetCategory
        fields = ['id', 'user', 'name', 'color', 'icon', 'is_default']


class AssetValueHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetValueHistory
        fields = ['id', 'asset', 'old_value', 'new_value', 'changed_at', 'note']


class AssetLiabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetLiability
        fields = ['id', 'asset', 'name', 'outstanding_amount', 'interest_rate', 'start_date', 'end_date']


class AssetSerializer(serializers.ModelSerializer):
    value_history = AssetValueHistorySerializer(many=True, read_only=True)
    liabilities = AssetLiabilitySerializer(many=True, read_only=True)

    class Meta:
        model = Asset
        fields = [
            'id', 'owner', 'name', 'category', 'description', 'acquisition_date', 'acquisition_value',
            'current_value', 'status', 'currency', 'created_at', 'updated_at', 'value_history', 'liabilities'
        ]
        read_only_fields = ['owner', 'created_at', 'updated_at']
