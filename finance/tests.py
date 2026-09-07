from datetime import date, datetime
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Account, Budget, Category, Role, SavingsGoal, Transaction, User


class ExportAndBudgetAlertTests(TestCase):
    def setUp(self):
        self.role = Role.objects.create(name='Suami', can_view_all=True)
        self.user = User.objects.create_user(
            username='suami',
            email='suami@example.com',
            password='secret123',
            pin_code='1234',
            role=self.role,
        )
        self.token, _ = Token.objects.get_or_create(user=self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')

        self.account = Account.objects.create(
            name='Kas Rumah',
            owner=self.user,
            type='cash',
            currency='IDR',
            starting_balance=Decimal('500000'),
        )
        self.category = Category.objects.create(name='Makanan', type='expense')
        self.income_category = Category.objects.create(name='Gaji', type='income')

        self.budget = Budget.objects.create(
            name='Budget Makanan',
            category=self.category,
            period='monthly',
            amount=Decimal('100000'),
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
        )
        self.savings_goal = SavingsGoal.objects.create(
            name='Dana Darurat',
            target_amount=Decimal('3000000'),
            current_amount=Decimal('500000'),
            target_date=date(2027, 6, 1),
            owner=self.user,
        )

        Transaction.objects.create(
            account=self.account,
            user=self.user,
            type='expense',
            amount=Decimal('75000'),
            currency='IDR',
            category=self.category,
            date=timezone.make_aware(datetime(2026, 9, 2, 10, 0, 0)),
            description='Belanja kebutuhan rumah',
            is_approved=True,
        )
        Transaction.objects.create(
            account=self.account,
            user=self.user,
            type='income',
            amount=Decimal('200000'),
            currency='IDR',
            category=self.income_category,
            date=timezone.make_aware(datetime(2026, 9, 1, 9, 0, 0)),
            description='Gaji bulan ini',
            is_approved=True,
        )

    def test_transactions_csv_export(self):
        response = self.client.get('/api/transactions/export/csv/?start=2026-09-01&end=2026-09-30')
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/csv', response['Content-Type'])
        self.assertIn('transactions-', response['Content-Disposition'])
        body = b''.join(response.streaming_content).decode('utf-8')
        self.assertIn('id,date', body)
        self.assertIn('Belanja kebutuhan rumah', body)

    def test_budget_alerts(self):
        response = self.client.get('/api/alerts/budgets/?threshold=0.7')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(len(payload) >= 1)
        self.assertTrue(any(item['category'] == 'Makanan' for item in payload))
        self.assertTrue(any(item['percent_used'] >= 0.7 for item in payload))

    def test_dashboard_summary(self):
        response = self.client.get('/api/dashboard/summary/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('total_balance', payload)
        self.assertIn('income_this_month', payload)
        self.assertIn('expense_this_month', payload)
        self.assertIn('budget_remaining', payload)
        self.assertIn('savings_progress', payload)
        self.assertIn('financial_health', payload)
        self.assertGreaterEqual(float(payload['income_this_month']), 0)
        self.assertGreaterEqual(float(payload['expense_this_month']), 0)

    def test_dashboard_summary_uses_only_current_user_accounts(self):
        other_user = User.objects.create_user(
            username='partner',
            email='partner@example.com',
            password='secret123',
            pin_code='4321',
        )
        Account.objects.create(
            name='Kas Partner',
            owner=other_user,
            type='cash',
            currency='IDR',
            starting_balance=Decimal('2500000'),
        )

        response = self.client.get('/api/dashboard/summary/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(float(payload['total_balance']), 625000.0)

    def test_dashboard_financial_health(self):
        Transaction.objects.create(
            account=self.account,
            user=self.user,
            type='expense',
            amount=Decimal('350000'),
            currency='IDR',
            category=self.category,
            date=timezone.make_aware(datetime(2026, 9, 8, 11, 0, 0)),
            description='Belanja besar tidak wajar',
            is_approved=True,
        )

        response = self.client.get('/api/dashboard/health/?period=monthly')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('expense_to_income_ratio', payload)
        self.assertIn('warning', payload)
        self.assertIn('monthly_savings_rate', payload)
        self.assertIn('savings_targets', payload)
        self.assertIn('anomalies', payload)
        self.assertGreater(float(payload['expense_to_income_ratio']), 0.8)
        self.assertIn(payload['warning'], ['aman', 'peringatan', 'kritis'])
        self.assertTrue(isinstance(payload['anomalies'], list))
        self.assertGreaterEqual(len(payload['anomalies']), 0)

    def test_dashboard_trend(self):
        response = self.client.get('/api/dashboard/trend/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsInstance(payload, list)
        self.assertGreaterEqual(len(payload), 6)
        self.assertIn('month', payload[0])
        self.assertIn('total_expense', payload[0])

    def test_dashboard_category_breakdown(self):
        response = self.client.get('/api/dashboard/category-breakdown/?period=monthly')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsInstance(payload, list)
        self.assertTrue(any(item['category_name'] == 'Makanan' for item in payload))
        self.assertIn('amount', payload[0])

    def test_dashboard_monthly_comparison(self):
        response = self.client.get('/api/dashboard/monthly-comparison/?months=6')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsInstance(payload, list)
        self.assertTrue(len(payload) >= 1)
        self.assertIn('income', payload[0])
        self.assertIn('expense', payload[0])
        self.assertIn('net', payload[0])

    def test_dashboard_cashflow(self):
        response = self.client.get('/api/dashboard/cashflow/?months=6')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsInstance(payload, list)
        self.assertTrue(len(payload) >= 1)
        self.assertIn('month', payload[0])
        self.assertIn('net', payload[0])
        self.assertIn('status', payload[0])

    def test_reports_summary(self):
        response = self.client.get('/api/reports/summary/?period=monthly')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('period', payload)
        self.assertIn('total_income', payload)
        self.assertIn('total_expense', payload)
        self.assertIn('budget_remaining', payload)
        self.assertIn('by_category', payload)
        self.assertIsInstance(payload['by_category'], list)

    def test_reports_export_excel(self):
        response = self.client.get('/api/reports/export/?format=excel&period=monthly')
        self.assertEqual(response.status_code, 200)
        self.assertIn('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', response['Content-Type'])
        self.assertIn('report', response['Content-Disposition'])

    def test_reports_custom_filtered_summary(self):
        response = self.client.get(
            f'/api/reports/summary/?start=2026-09-01&end=2026-09-30&user={self.user.id}&account={self.account.id}&category={self.category.id}'
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('total_expense', payload)
        self.assertGreaterEqual(float(payload['total_expense']), 0)

    def test_savings_goal_api_includes_account(self):
        response = self.client.post(
            '/api/savings/',
            {
                'name': 'Dana Liburan',
                'target_amount': '5000000',
                'current_amount': '1000000',
                'target_date': '2027-12-31',
                'account': self.account.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.content)
        payload = response.json()
        self.assertEqual(payload['account'], self.account.id)
        self.assertEqual(payload['owner'], self.user.id)

    def test_account_reset_balance_action(self):
        Transaction.objects.create(
            account=self.account,
            user=self.user,
            type='income',
            amount=Decimal('200000'),
            currency='IDR',
            category=self.income_category,
            date=timezone.make_aware(datetime(2026, 9, 3, 9, 0, 0)),
            description='Tambahan saldo',
            is_approved=True,
        )

        response = self.client.post(f'/api/accounts/{self.account.id}/reset-balance/')
        self.assertEqual(response.status_code, 200, response.content)
        self.account.refresh_from_db()
        self.assertEqual(self.account.starting_balance, Decimal('0'))
        self.assertEqual(Transaction.objects.filter(account=self.account).count(), 0)
