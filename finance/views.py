import calendar
import csv
import datetime
import io
import math

from decimal import Decimal

from django.db.models import Avg, Q

from django.db.models import Sum
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Role, User, Account, Category, Transaction, Budget, SavingsGoal, Allowance,
    Asset, AssetCategory, AssetValueHistory, AssetLiability
)
from .serializers import (
    RoleSerializer, UserSerializer, AccountSerializer, CategorySerializer,
    TransactionSerializer, BudgetSerializer, SavingsGoalSerializer, AllowanceSerializer
)

from .serializers import (
    AssetSerializer, AssetCategorySerializer, AssetValueHistorySerializer, AssetLiabilitySerializer
)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class AccountViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Account.objects.all()
    serializer_class = AccountSerializer

    def get_queryset(self):
        user = self.request.user
        return Account.objects.filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'], url_path='reset-balance')
    def reset_balance(self, request, pk=None):
        account = self.get_object()
        if account.owner_id != request.user.id:
            return Response({'detail': 'Anda tidak memiliki akses ke rekening ini.'}, status=403)

        Transaction.objects.filter(Q(account=account) | Q(related_account=account)).delete()
        account.starting_balance = Decimal('0')
        account.save(update_fields=['starting_balance'])

        serializer = self.get_serializer(account)
        return Response(serializer.data)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all().order_by('-date')
    serializer_class = TransactionSerializer


class BudgetViewSet(viewsets.ModelViewSet):
    queryset = Budget.objects.all()
    serializer_class = BudgetSerializer


class SavingsGoalViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SavingsGoal.objects.all()
    serializer_class = SavingsGoalSerializer

    def get_queryset(self):
        user = self.request.user
        return SavingsGoal.objects.filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class AllowanceViewSet(viewsets.ModelViewSet):
    queryset = Allowance.objects.all()
    serializer_class = AllowanceSerializer


# --- Asset ViewSets (manual entry MVP) ---
class AssetViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer

    def get_queryset(self):
        user = self.request.user
        return Asset.objects.filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        # if current_value changed, record history
        instance = self.get_object()
        old_value = instance.current_value
        new_instance = serializer.save()
        try:
            new_value = new_instance.current_value
            if new_value != old_value:
                note = None
                try:
                    note = self.request.data.get('note')
                except Exception:
                    note = None
                AssetValueHistory.objects.create(
                    asset=new_instance,
                    old_value=old_value,
                    new_value=new_value,
                    note=note or 'Manual update via API',
                )
        except Exception:
            pass


class AssetCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = AssetCategory.objects.all()
    serializer_class = AssetCategorySerializer

    def get_queryset(self):
        user = self.request.user
        return AssetCategory.objects.filter(Q(user=user) | Q(user__isnull=True))


class AssetValueHistoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = AssetValueHistory.objects.all()
    serializer_class = AssetValueHistorySerializer

    def get_queryset(self):
        user = self.request.user
        return AssetValueHistory.objects.filter(asset__owner=user)


class AssetLiabilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = AssetLiability.objects.all()
    serializer_class = AssetLiabilitySerializer

    def get_queryset(self):
        user = self.request.user
        return AssetLiability.objects.filter(asset__owner=user)


class TransactionsCSVExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Transaction.objects.select_related('account', 'user', 'category', 'related_account').all()

        start = request.GET.get('start')
        end = request.GET.get('end')
        user_id = request.GET.get('user')
        account_id = request.GET.get('account')
        category_id = request.GET.get('category')

        if start:
            try:
                queryset = queryset.filter(date__date__gte=datetime.date.fromisoformat(start))
            except ValueError:
                pass
        if end:
            try:
                queryset = queryset.filter(date__date__lte=datetime.date.fromisoformat(end))
            except ValueError:
                pass
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        queryset = queryset.order_by('-date')

        def row_iter():
            buffer = io.StringIO()
            writer = csv.writer(buffer)
            writer.writerow([
                'id', 'date', 'account', 'user', 'type', 'category',
                'amount', 'currency', 'description', 'related_account', 'is_approved'
            ])
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

            for item in queryset:
                writer.writerow([
                    item.id,
                    item.date.isoformat(),
                    item.account.name if item.account else '',
                    item.user.username if item.user else '',
                    item.type,
                    item.category.name if item.category else '',
                    str(item.amount),
                    item.currency,
                    (item.description or '').replace('\n', ' '),
                    item.related_account.name if item.related_account else '',
                    'true' if item.is_approved else 'false',
                ])
                yield buffer.getvalue()
                buffer.seek(0)
                buffer.truncate(0)

        filename = f'transactions-{timezone.now().strftime("%Y%m%d-%H%M%S")}.csv'
        response = StreamingHttpResponse(row_iter(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


def month_range_for(date_value):
    first_day = date_value.replace(day=1)
    last_day = calendar.monthrange(first_day.year, first_day.month)[1]
    return first_day, first_day.replace(day=last_day)


def account_balance(account):
    balance = Decimal(str(account.starting_balance or 0))
    for transaction in Transaction.objects.filter(account=account).order_by('date'):
        if transaction.type == 'income':
            balance += Decimal(str(transaction.amount or 0))
        elif transaction.type == 'expense':
            balance -= Decimal(str(transaction.amount or 0))
        elif transaction.type == 'transfer':
            if transaction.related_account_id == account.id:
                balance += Decimal(str(transaction.amount or 0))
            if transaction.account_id == account.id:
                balance -= Decimal(str(transaction.amount or 0))
    return balance


def get_report_window(period, request):
    period = (period or request.GET.get('period', 'monthly') or 'monthly').lower()
    start = request.GET.get('start')
    end = request.GET.get('end')

    if start or end:
        start_date = datetime.date.fromisoformat(start) if start else None
        end_date = datetime.date.fromisoformat(end) if end else None
        if start_date and end_date and start_date > end_date:
            start_date, end_date = end_date, start_date
        return start_date, end_date

    today = timezone.now().date()
    if period == 'yearly':
        return today.replace(month=1, day=1), today.replace(month=12, day=31)
    return month_range_for(today)


def get_previous_period_window(start, end):
    if not start or not end:
        return None, None
    span_days = (end - start).days + 1
    prev_end = start - datetime.timedelta(days=1)
    prev_start = prev_end - datetime.timedelta(days=span_days - 1)
    return prev_start, prev_end


def get_filtered_transaction_queryset(request, start=None, end=None):
    queryset = Transaction.objects.select_related('account', 'user', 'category', 'related_account').all()

    if request.user and getattr(request.user, 'is_authenticated', False):
        queryset = queryset.filter(user=request.user)

    if start is not None:
        queryset = queryset.filter(date__date__gte=start)
    if end is not None:
        queryset = queryset.filter(date__date__lte=end)

    user_id = request.GET.get('user')
    account_id = request.GET.get('account')
    category_id = request.GET.get('category')
    if user_id:
        queryset = queryset.filter(user_id=user_id)
    if account_id:
        queryset = queryset.filter(account_id=account_id)
    if category_id:
        queryset = queryset.filter(category_id=category_id)

    return queryset


def get_budget_total_for_period(start, end, category_id=None):
    budgets = Budget.objects.select_related('category').all()
    if category_id:
        budgets = budgets.filter(category_id=category_id)

    total = Decimal('0')
    for budget in budgets:
        budget_start = budget.start_date or start
        budget_end = budget.end_date or end
        if budget_start and budget_end:
            if budget_start <= end and budget_end >= start:
                total += Decimal(str(budget.amount or 0))
        elif budget.period == 'monthly':
            period_start, period_end = month_range_for(start)
            if period_start <= end and period_end >= start:
                total += Decimal(str(budget.amount or 0))
        elif budget.period == 'weekly':
            weekly_start = start - datetime.timedelta(days=start.weekday())
            weekly_end = weekly_start + datetime.timedelta(days=6)
            if weekly_start <= end and weekly_end >= start:
                total += Decimal(str(budget.amount or 0))
        elif budget.period == 'yearly':
            annual_start = start.replace(month=1, day=1)
            annual_end = start.replace(month=12, day=31)
            if annual_start <= end and annual_end >= start:
                total += Decimal(str(budget.amount or 0))
    return total


def calculate_financial_health(period, request):
    period = (period or request.GET.get('period', 'monthly') or 'monthly').lower()
    start, end = get_report_window(period, request)
    queryset = get_filtered_transaction_queryset(request, start, end)

    total_income = queryset.filter(type='income').aggregate(total=Sum('amount')).get('total') or Decimal('0')
    total_expense = queryset.filter(type='expense').aggregate(total=Sum('amount')).get('total') or Decimal('0')

    income_value = float(total_income)
    expense_value = float(total_expense)
    expense_to_income_ratio = (expense_value / income_value) if income_value else 0.0
    monthly_savings_rate = ((income_value - expense_value) / income_value) if income_value else 0.0

    if expense_to_income_ratio < 0.8:
        warning = 'aman'
    elif expense_to_income_ratio < 1.0:
        warning = 'peringatan'
    else:
        warning = 'kritis'

    monthly_net_saving = max(income_value - expense_value, 0.0)
    savings_targets = []
    if request.user and getattr(request.user, 'is_authenticated', False):
        goals = SavingsGoal.objects.filter(owner=request.user)
    else:
        goals = SavingsGoal.objects.all()

    for goal in goals:
        target_amount = Decimal(str(goal.target_amount or 0))
        current_amount = Decimal(str(goal.current_amount or 0))
        remaining_amount = max(target_amount - current_amount, Decimal('0'))
        progress = float(current_amount / target_amount) if target_amount else 0.0
        months_to_goal = None
        if remaining_amount > 0 and monthly_net_saving > 0:
            months_to_goal = max(1, math.ceil(float(remaining_amount) / monthly_net_saving)) if monthly_net_saving else None
        savings_targets.append({
            'id': goal.id,
            'name': goal.name,
            'current_amount': str(current_amount),
            'target_amount': str(target_amount),
            'remaining_amount': str(remaining_amount),
            'progress': round(progress, 4),
            'estimated_months_to_goal': months_to_goal,
            'status': 'completed' if remaining_amount == 0 else 'on_track' if monthly_net_saving > 0 else 'needs_attention',
        })

    anomalies = []
    expense_transactions = queryset.filter(type='expense').select_related('category')
    category_groups = {}
    for item in expense_transactions:
        category_groups.setdefault(item.category_id, {'name': item.category.name if item.category else 'Lainnya', 'items': []})
        category_groups[item.category_id]['items'].append(item)

    for category_id, payload in category_groups.items():
        items = payload['items']
        if not items:
            continue
        amounts = [Decimal(str(item.amount or 0)) for item in items]
        average_amount = sum(amounts, Decimal('0')) / Decimal(len(amounts))
        if average_amount <= 0:
            continue
        for item in items:
            amount = Decimal(str(item.amount or 0))
            if amount > average_amount * Decimal('3'):
                anomalies.append({
                    'transaction_id': item.id,
                    'category': payload['name'],
                    'description': item.description or 'Transaksi',
                    'date': item.date.isoformat(),
                    'amount': str(amount),
                    'average_category_amount': str(average_amount),
                    'multiplier': round(float(amount / average_amount), 2) if average_amount else 0.0,
                    'severity': 'high' if amount > average_amount * Decimal('5') else 'medium',
                })

    anomalies = sorted(anomalies, key=lambda item: item['multiplier'], reverse=True)

    return {
        'period': period,
        'start_date': start.isoformat() if start else None,
        'end_date': end.isoformat() if end else None,
        'total_income': str(total_income),
        'total_expense': str(total_expense),
        'expense_to_income_ratio': round(expense_to_income_ratio, 4),
        'expense_to_income_percentage': round(expense_to_income_ratio * 100, 2),
        'warning': warning,
        'monthly_savings_rate': round(monthly_savings_rate, 4),
        'monthly_savings_amount': str(Decimal(str(monthly_net_saving))),
        'savings_targets': savings_targets,
        'anomalies': anomalies,
    }


class ReportSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = (request.GET.get('period') or 'monthly').lower()
        start, end = get_report_window(period, request)
        queryset = get_filtered_transaction_queryset(request, start, end)
        prev_start, prev_end = get_previous_period_window(start, end) if start and end else (None, None)
        prev_queryset = get_filtered_transaction_queryset(request, prev_start, prev_end) if prev_start and prev_end else queryset.none()

        total_income = queryset.filter(type='income').aggregate(total=Sum('amount')).get('total') or Decimal('0')
        total_expense = queryset.filter(type='expense').aggregate(total=Sum('amount')).get('total') or Decimal('0')
        prev_income = prev_queryset.filter(type='income').aggregate(total=Sum('amount')).get('total') or Decimal('0')
        prev_expense = prev_queryset.filter(type='expense').aggregate(total=Sum('amount')).get('total') or Decimal('0')

        category_breakdown = queryset.filter(type='expense').values('category__name').annotate(amount=Sum('amount')).order_by('-amount')
        category_payload = []
        for item in category_breakdown:
            amount = Decimal(str(item['amount'] or 0))
            category_payload.append({
                'category': item['category__name'] or 'Lainnya',
                'amount': str(amount),
            })

        total_budget = get_budget_total_for_period(start, end, request.GET.get('category'))
        budget_remaining = total_budget - total_expense

        payload = {
            'period': period,
            'start_date': start.isoformat() if start else None,
            'end_date': end.isoformat() if end else None,
            'total_income': str(total_income),
            'total_expense': str(total_expense),
            'net': str(total_income - total_expense),
            'budget_remaining': str(budget_remaining),
            'comparison_previous_period': {
                'previous_start_date': prev_start.isoformat() if prev_start else None,
                'previous_end_date': prev_end.isoformat() if prev_end else None,
                'previous_total_income': str(prev_income),
                'previous_total_expense': str(prev_expense),
                'income_delta': str(total_income - prev_income),
                'expense_delta': str(total_expense - prev_expense),
                'net_delta': str((total_income - total_expense) - (prev_income - prev_expense)),
            },
            'by_category': category_payload,
        }
        return Response(payload)


class ReportExportView(APIView):
    permission_classes = [IsAuthenticated]
    format_kwarg = None

    def get(self, request):
        period = (request.GET.get('period') or 'monthly').lower()
        start, end = get_report_window(period, request)
        queryset = get_filtered_transaction_queryset(request, start, end)

        summary = ReportSummaryView()
        summary_request = request
        summary_payload = summary.get(summary_request).data

        rows = [
            ['Periode', summary_payload.get('period')],
            ['Tanggal Mulai', summary_payload.get('start_date')],
            ['Tanggal Selesai', summary_payload.get('end_date')],
            ['Total Pemasukan', summary_payload.get('total_income')],
            ['Total Pengeluaran', summary_payload.get('total_expense')],
            ['Net', summary_payload.get('net')],
            ['Sisa Anggaran', summary_payload.get('budget_remaining')],
            [],
            ['Kategori', 'Jumlah'],
        ]
        for item in summary_payload.get('by_category', []):
            rows.append([item.get('category'), item.get('amount')])

        format_name = (request.GET.get('format') or 'excel').lower()
        filename = f'report-{timezone.now().strftime("%Y%m%d-%H%M%S")}.csv'
        if format_name == 'pdf':
            content = '\n'.join([', '.join([str(cell) for cell in row]) for row in rows])
            response = Response(content, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename.replace(".csv", ".txt")}"'
            return response

        output = io.StringIO()
        writer = csv.writer(output)
        for row in rows:
            writer.writerow(row)

        content = output.getvalue()
        response = Response(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        start_of_month, end_of_month = month_range_for(today)

        user_accounts = Account.objects.filter(owner=request.user)
        total_balance = sum(
            (account_balance(account) for account in user_accounts),
            Decimal('0'),
        )

        income_this_month = Transaction.objects.filter(
            user=request.user,
            type='income',
            date__date__gte=start_of_month,
            date__date__lte=end_of_month,
        ).aggregate(total=Sum('amount')).get('total') or Decimal('0')

        expense_this_month = Transaction.objects.filter(
            user=request.user,
            type='expense',
            date__date__gte=start_of_month,
            date__date__lte=end_of_month,
        ).aggregate(total=Sum('amount')).get('total') or Decimal('0')

        total_budget = Decimal('0')
        for budget in Budget.objects.select_related('category').filter(category__isnull=False):
            if budget.start_date and budget.end_date:
                start_date = budget.start_date
                end_date = budget.end_date
            else:
                if budget.period == 'monthly':
                    start_date, end_date = month_range_for(today)
                elif budget.period == 'weekly':
                    start_date = today - datetime.timedelta(days=today.weekday())
                    end_date = start_date + datetime.timedelta(days=6)
                elif budget.period == 'yearly':
                    start_date = today.replace(month=1, day=1)
                    end_date = today.replace(month=12, day=31)
                else:
                    start_date = today
                    end_date = today

            if start_date <= end_of_month and end_date >= start_of_month:
                total_budget += Decimal(str(budget.amount or 0))

        savings_current = SavingsGoal.objects.filter(owner=request.user).aggregate(total=Sum('current_amount')).get('total') or Decimal('0')
        savings_target = SavingsGoal.objects.filter(owner=request.user).aggregate(total=Sum('target_amount')).get('total') or Decimal('0')
        savings_progress = float(savings_current / savings_target) if savings_target else 0.0
        financial_health = calculate_financial_health('monthly', request)

        payload = {
            'total_balance': str(total_balance),
            'income_this_month': str(income_this_month),
            'expense_this_month': str(expense_this_month),
            'budget_remaining': str(total_budget - expense_this_month),
            'savings_progress': savings_progress,
            'savings_current': str(savings_current),
            'savings_target': str(savings_target),
            'financial_health': financial_health,
        }
        return Response(payload)


class DashboardHealthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.GET.get('period', 'monthly')
        return Response(calculate_financial_health(period, request))


class DashboardTrendView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        trend = []
        months = []

        for offset in range(5, -1, -1):
            month_date = today.replace(day=1)
            month_index = (month_date.month - 1) - offset
            year = month_date.year + (month_index // 12)
            month = (month_index % 12) + 1
            month_start = month_date.replace(year=year, month=month, day=1)
            last_day = calendar.monthrange(month_start.year, month_start.month)[1]
            month_end = month_start.replace(day=last_day)
            months.append((month_start, month_end))

        for month_start, month_end in months:
            qs = Transaction.objects.filter(date__date__gte=month_start, date__date__lte=month_end)
            if request.user and getattr(request.user, 'is_authenticated', False):
                qs = qs.filter(user=request.user)
            total_expense = qs.filter(type='expense').aggregate(total=Sum('amount')).get('total') or Decimal('0')

            trend.append({
                'month': month_start.strftime('%b'),
                'total_expense': str(total_expense),
            })

        return Response(trend)


class DashboardCategoryBreakdownView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.GET.get('period', 'monthly').lower()
        user_id = request.GET.get('user')
        category_id = request.GET.get('category')
        start = request.GET.get('start')
        end = request.GET.get('end')

        queryset = Transaction.objects.filter(type='expense').select_related('category')
        if request.user and getattr(request.user, 'is_authenticated', False):
            queryset = queryset.filter(user=request.user)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        if start:
            try:
                queryset = queryset.filter(date__date__gte=datetime.date.fromisoformat(start))
            except ValueError:
                pass
        if end:
            try:
                queryset = queryset.filter(date__date__lte=datetime.date.fromisoformat(end))
            except ValueError:
                pass

        if not start or not end:
            today = timezone.now().date()
            if period == 'yearly':
                start_date = today.replace(month=1, day=1)
                end_date = today.replace(month=12, day=31)
            else:
                start_date, end_date = month_range_for(today)
            queryset = queryset.filter(date__date__gte=start_date, date__date__lte=end_date)

        grouped = queryset.values('category_id', 'category__name').annotate(amount=Sum('amount')).order_by('-amount')
        total_amount = sum((Decimal(str(item['amount'] or 0)) for item in grouped), Decimal('0'))

        payload = []
        for item in grouped:
            amount = Decimal(str(item['amount'] or 0))
            share = float(amount / total_amount) if total_amount else 0.0
            payload.append({
                'category_id': item['category_id'],
                'category_name': item['category__name'] or 'Lainnya',
                'amount': str(amount),
                'share': round(share, 4),
            })

        return Response(payload)


class DashboardMonthlyComparisonView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        months = int(request.GET.get('months', '6'))
        months = max(1, min(months, 12))
        user_id = request.GET.get('user')
        category_id = request.GET.get('category')

        today = timezone.now().date().replace(day=1)
        payload = []

        for offset in range(months - 1, -1, -1):
            month_index = (today.month - 1) - offset
            year = today.year + (month_index // 12)
            month = (month_index % 12) + 1
            month_start = today.replace(year=year, month=month, day=1)
            last_day = calendar.monthrange(month_start.year, month_start.month)[1]
            month_end = month_start.replace(day=last_day)

            queryset = Transaction.objects.filter(date__date__gte=month_start, date__date__lte=month_end)
            if request.user and getattr(request.user, 'is_authenticated', False):
                queryset = queryset.filter(user=request.user)
            if user_id:
                queryset = queryset.filter(user_id=user_id)
            if category_id:
                queryset = queryset.filter(category_id=category_id)

            income = queryset.filter(type='income').aggregate(total=Sum('amount')).get('total') or Decimal('0')
            expense = queryset.filter(type='expense').aggregate(total=Sum('amount')).get('total') or Decimal('0')

            payload.append({
                'month': month_start.strftime('%b'),
                'label': month_start.strftime('%b %Y'),
                'income': str(income),
                'expense': str(expense),
                'net': str(income - expense),
            })

        return Response(payload)


class DashboardCashflowView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        months = int(request.GET.get('months', '6'))
        months = max(1, min(months, 12))
        user_id = request.GET.get('user')
        category_id = request.GET.get('category')

        today = timezone.now().date().replace(day=1)
        payload = []

        for offset in range(months - 1, -1, -1):
            month_index = (today.month - 1) - offset
            year = today.year + (month_index // 12)
            month = (month_index % 12) + 1
            month_start = today.replace(year=year, month=month, day=1)
            last_day = calendar.monthrange(month_start.year, month_start.month)[1]
            month_end = month_start.replace(day=last_day)

            queryset = Transaction.objects.filter(date__date__gte=month_start, date__date__lte=month_end)
            if request.user and getattr(request.user, 'is_authenticated', False):
                queryset = queryset.filter(user=request.user)
            if user_id:
                queryset = queryset.filter(user_id=user_id)
            if category_id:
                queryset = queryset.filter(category_id=category_id)

            income = queryset.filter(type='income').aggregate(total=Sum('amount')).get('total') or Decimal('0')
            expense = queryset.filter(type='expense').aggregate(total=Sum('amount')).get('total') or Decimal('0')
            net = income - expense

            payload.append({
                'month': month_start.strftime('%b'),
                'label': month_start.strftime('%b %Y'),
                'income': str(income),
                'expense': str(expense),
                'net': str(net),
                'status': 'surplus' if net > 0 else 'deficit' if net < 0 else 'balanced',
            })

        return Response(payload)


class BudgetAlertsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            threshold = float(request.GET.get('threshold', '0.9'))
        except ValueError:
            threshold = 0.9

        today = timezone.now().date()
        alerts = []

        budgets = Budget.objects.select_related('category').all()
        for budget in budgets:
            if budget.start_date and budget.end_date:
                start_date = budget.start_date
                end_date = budget.end_date
            else:
                if budget.period == 'monthly':
                    start_date = today.replace(day=1)
                    last_day = calendar.monthrange(start_date.year, start_date.month)[1]
                    end_date = start_date.replace(day=last_day)
                elif budget.period == 'weekly':
                    start_date = today - datetime.timedelta(days=today.weekday())
                    end_date = start_date + datetime.timedelta(days=6)
                elif budget.period == 'yearly':
                    start_date = today.replace(month=1, day=1)
                    end_date = today.replace(month=12, day=31)
                else:
                    start_date = today
                    end_date = today

            used_qs = Transaction.objects.filter(
                category=budget.category,
                type='expense',
                date__date__gte=start_date,
                date__date__lte=end_date,
            )
            if request.user and getattr(request.user, 'is_authenticated', False):
                used_qs = used_qs.filter(user=request.user)
            used_total = used_qs.aggregate(total=Sum('amount')).get('total') or Decimal('0')

            budget_amount = budget.amount or Decimal('0')
            percent_used = float(used_total) / float(budget_amount) if budget_amount else 0.0

            if percent_used >= threshold:
                alerts.append({
                    'budget_id': budget.id,
                    'budget_name': budget.name,
                    'category': budget.category.name if budget.category else None,
                    'period': budget.period,
                    'period_start': start_date.isoformat(),
                    'period_end': end_date.isoformat(),
                    'budget_amount': str(budget_amount),
                    'used_amount': str(used_total),
                    'percent_used': round(percent_used, 4),
                    'status': 'warning' if percent_used < 1 else 'critical',
                })

        return Response(alerts)
