from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RoleViewSet, UserViewSet, AccountViewSet, CategoryViewSet,
    TransactionViewSet, BudgetViewSet, SavingsGoalViewSet, AllowanceViewSet,
    AssetViewSet, AssetCategoryViewSet, AssetValueHistoryViewSet, AssetLiabilityViewSet,
    TransactionsCSVExportView, BudgetAlertsView, ReportSummaryView, ReportExportView,
    DashboardSummaryView, DashboardHealthView, DashboardTrendView, DashboardCategoryBreakdownView,
    DashboardMonthlyComparisonView, DashboardCashflowView,
)
from .auth_views import PinAuthView

router = DefaultRouter()
router.register('roles', RoleViewSet)
router.register('users', UserViewSet)
router.register('accounts', AccountViewSet)
router.register('categories', CategoryViewSet)
router.register('transactions', TransactionViewSet)
router.register('budgets', BudgetViewSet)
router.register('savings', SavingsGoalViewSet)
router.register('allowances', AllowanceViewSet)
router.register('assets', AssetViewSet)
router.register('asset-categories', AssetCategoryViewSet)
router.register('asset-value-history', AssetValueHistoryViewSet)
router.register('asset-liabilities', AssetLiabilityViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('auth/pin/', PinAuthView.as_view(), name='pin-auth'),
    path('transactions/export/csv/', TransactionsCSVExportView.as_view(), name='transactions-export-csv'),
    path('alerts/budgets/', BudgetAlertsView.as_view(), name='budget-alerts'),
    path('reports/summary/', ReportSummaryView.as_view(), name='report-summary'),
    path('reports/export/', ReportExportView.as_view(), name='report-export'),
    path('dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('dashboard/health/', DashboardHealthView.as_view(), name='dashboard-health'),
    path('dashboard/trend/', DashboardTrendView.as_view(), name='dashboard-trend'),
    path('dashboard/category-breakdown/', DashboardCategoryBreakdownView.as_view(), name='dashboard-category-breakdown'),
    path('dashboard/monthly-comparison/', DashboardMonthlyComparisonView.as_view(), name='dashboard-monthly-comparison'),
    path('dashboard/cashflow/', DashboardCashflowView.as_view(), name='dashboard-cashflow'),
]
