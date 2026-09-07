import React, { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const STORAGE_KEY = 'fftrack-auth'
const THEME_KEY = 'fftrack-theme'

function formatRupiah(value) {
  const number = Number(value || 0)
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(number)
}

function formatPercent(value) {
  return `${Math.round((Number(value || 0)) * 100)}%`
}

function apiRequest(path, token, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
  })
}

function LoginPage({ onLogin, loading, error }) {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    onLogin(username, pin)
  }

  return (
    <div className="page-shell login-shell">
      <div className="login-card">
        <div className="brand-block">
          <span className="brand-badge">FF</span>
          <h1>Financial Freedom</h1>
          <p>Kelola rumah tangga dengan lebih tenang</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="contoh: suami" required />
          </label>

          <label>
            PIN
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4 digit" maxLength={4} required />
          </label>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Sidebar({ user, onLogout, mobileOpen = false, onClose }) {
  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/transactions', label: 'Transaksi' },
    { path: '/accounts', label: 'Rekening' },
    { path: '/categories', label: 'Kategori' },
    { path: '/assets', label: 'Aset' },
    { path: '/budgets', label: 'Anggaran' },
    { path: '/savings', label: 'Tabungan' },
    { path: '/family', label: 'Keluarga' },
    { path: '/allowances', label: 'Tunjangan' },
    { path: '/reports', label: 'Laporan' },
  ]

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-block compact">
          <span className="brand-badge">FF</span>
          <div>
            <h2>Financial Freedom</h2>
          </div>
        </div>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="Tutup menu">✕</button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="avatar">{(user?.username || 'U').slice(0, 1).toUpperCase()}</div>
        <div>
          <strong>{user?.username || 'User'}</strong>
          <small>Aktif</small>
        </div>
        <button className="ghost-btn" type="button" onClick={onLogout}>Keluar</button>
      </div>
    </aside>
  )
}

function Topbar({ title, theme, onToggleTheme, onToggleMenu, mobileMenuOpen }) {
  return (
    <header className="topbar">
      <div className="topbar-title-wrap">
        <button
          type="button"
          className={`hamburger-btn ${mobileMenuOpen ? 'open' : ''}`}
          aria-label="Buka menu"
          aria-expanded={mobileMenuOpen}
          onClick={onToggleMenu}
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <p className="eyebrow">family dashboard</p>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="topbar-actions">
        <button className="icon-btn" type="button" onClick={onToggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
        <div className="notification-pill">3</div>
      </div>
    </header>
  )
}

function StatCard({ label, value, tone = 'default' }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state-card">
      <div className="empty-state-icon">•</div>
      <h4>{title}</h4>
      <p>{description}</p>
      {action}
    </div>
  )
}

function Modal({ open, title, message, confirmText = 'Lanjutkan', cancelText = 'Batal', onConfirm, onCancel, variant = 'danger' }) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className={`modal-icon ${variant}`}>!</div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>{cancelText}</button>
          <button type="button" className="primary-btn" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}

function ProgressBar({ percent, color = '#10b981' }) {
  return (
    <div className="progress-rail">
      <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }} />
    </div>
  )
}

function DashboardPage({ token }) {
  const [summary, setSummary] = useState({
    total_balance: 0,
    income_this_month: 0,
    expense_this_month: 0,
    budget_remaining: 0,
    savings_progress: 0,
    financial_health: { expense_to_income_percentage: 0, monthly_savings_rate: 0, warning: 'aman', savings_targets: [], anomalies: [] },
  })
  const [alerts, setAlerts] = useState([])
  const [trend, setTrend] = useState([])
  const [categoryBreakdown, setCategoryBreakdown] = useState([])
  const [monthlyComparison, setMonthlyComparison] = useState([])
  const [cashflow, setCashflow] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const [summaryRes, alertsRes, trendRes, categoryRes, monthlyRes, cashflowRes] = await Promise.all([
          apiRequest('/api/dashboard/summary/', token),
          apiRequest('/api/alerts/budgets/?threshold=0.8', token),
          apiRequest('/api/dashboard/trend/', token),
          apiRequest('/api/dashboard/category-breakdown/?period=monthly', token),
          apiRequest('/api/dashboard/monthly-comparison/?months=6', token),
          apiRequest('/api/dashboard/cashflow/?months=6', token),
        ])

        if (!summaryRes.ok || !alertsRes.ok || !trendRes.ok || !categoryRes.ok || !monthlyRes.ok || !cashflowRes.ok) {
          throw new Error('Gagal memuat dashboard')
        }

        const summaryData = await summaryRes.json()
        const alertsData = await alertsRes.json()
        const trendData = await trendRes.json()
        const categoryData = await categoryRes.json()
        const monthlyData = await monthlyRes.json()
        const cashflowData = await cashflowRes.json()

        setSummary(summaryData)
        setAlerts(Array.isArray(alertsData) ? alertsData : [])
        setTrend(Array.isArray(trendData) ? trendData : [])
        // Normalize category breakdown: ensure `category_name` exists and `amount` is a Number
        const normalizedCategory = (Array.isArray(categoryData) ? categoryData : []).map((it) => ({
          ...it,
          category_name: it.category_name || it.category || it.name || 'Kategori',
          amount: typeof it.amount === 'number' ? it.amount : Number(it.amount || 0),
        }))
        setCategoryBreakdown(normalizedCategory)
        setMonthlyComparison(Array.isArray(monthlyData) ? monthlyData : [])
        setCashflow(Array.isArray(cashflowData) ? cashflowData : [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token])

  const pieColors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']
  const health = summary.financial_health || {}

  const totalCategoryAmount = categoryBreakdown.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const insightCards = [
    { label: 'Rasio pengeluaran', value: `${Number(health.expense_to_income_percentage || 0).toFixed(1)}%`, tone: 'expense' },
    { label: 'Tabungan bulanan', value: `${Number((health.monthly_savings_rate || 0) * 100).toFixed(1)}%`, tone: 'income' },
    { label: 'Target aktif', value: String((health.savings_targets || []).length), tone: 'balance' },
    { label: 'Anomali', value: String((health.anomalies || []).length), tone: 'warning' },
  ]

  if (loading) return <div className="page-state">Memuat dashboard...</div>
  if (error) return <div className="page-state error">{error}</div>

  return (
    <div className="page-stack">
      <section className="stats-grid">
        <StatCard label="Total Saldo" value={formatRupiah(summary.total_balance)} tone="balance" />
        <StatCard label="Pemasukan Bulan Ini" value={formatRupiah(summary.income_this_month)} tone="income" />
        <StatCard label="Pengeluaran Bulan Ini" value={formatRupiah(summary.expense_this_month)} tone="expense" />
        <StatCard label="Sisa Anggaran" value={formatRupiah(summary.budget_remaining)} tone="balance" />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Insight cepat</h3>
        </div>
        <div className="insight-grid">
          {insightCards.map((item) => (
            <div key={item.label} className={`insight-card ${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Analisis Keuangan</h3>
        </div>
        <div className="health-grid">
          <div className="health-card">
            <span>Rasio pengeluaran / pemasukan</span>
            <strong>{Number(health.expense_to_income_percentage || 0).toFixed(1)}%</strong>
            <small>{health.warning || 'aman'}</small>
          </div>
          <div className="health-card">
            <span>Tingkat tabungan</span>
            <strong>{Number((health.monthly_savings_rate || 0) * 100).toFixed(1)}%</strong>
            <small>{formatRupiah(summary.savings_current || 0)}</small>
          </div>
          <div className="health-card">
            <span>Anomali</span>
            <strong>{(health.anomalies || []).length}</strong>
            <small>{(health.anomalies || []).length ? 'Terdeteksi' : 'Aman'}</small>
          </div>
        </div>
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="panel-header">
            <h3>Tren pengeluaran 6 bulan</h3>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatRupiah(value)} />
                <Line type="monotone" dataKey="total_expense" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Distribusi kategori</h3>
          </div>
          <div className="chart-box compact-chart">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                {/* Full pie (no inner hole) and no padding between slices for solid circle */}
                <Pie
                  data={categoryBreakdown}
                  dataKey="amount"
                  nameKey="category_name"
                  innerRadius={0}
                  outerRadius={85}
                  paddingAngle={0}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categoryBreakdown.map((entry, index) => (
                    <Cell
                      key={entry.category_name || index}
                      fill={pieColors[index % pieColors.length]}
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatRupiah(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-list">
            {categoryBreakdown.map((item, index) => {
              const pct = totalCategoryAmount ? ((Number(item.amount) || 0) / totalCategoryAmount) * 100 : 0
              return (
                <div key={item.category_name || index} className="legend-item">
                  <span className="dot" style={{ background: pieColors[index % pieColors.length] }} />
                  <span>{item.category_name}</span>
                  <strong>{formatRupiah(item.amount)} · {pct.toFixed(0)}%</strong>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="panel-header">
            <h3>Perbandingan bulanan</h3>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatRupiah(value)} />
                <Bar dataKey="income" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Arus kas</h3>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value) => formatRupiah(value)} />
                <Bar dataKey="net" radius={[8, 8, 0, 0]}>
                  {cashflow.map((entry, index) => (
                    <Cell key={`${entry.label}-${index}`} fill={Number(entry.net) >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="panel-header">
            <h3>Peringatan anggaran</h3>
          </div>
          <div className="stack-list">
            {alerts.length === 0 ? (
              <EmptyState title="Semua anggaran sehat" description="Belum ada budget yang mendekati batas limit saat ini." />
            ) : (
              alerts.map((item) => (
                <div key={item.budget_id} className="alert-card">
                  <div className="alert-header">
                    <strong>{item.category}</strong>
                    <span>{item.status}</span>
                  </div>
                  <small>{item.budget_name}</small>
                  <ProgressBar percent={Math.min(100, (item.percent_used || 0) * 100)} color={item.status === 'critical' ? '#ef4444' : '#f59e0b'} />
                  <div className="pair-row">
                    <span>{Math.round((item.percent_used || 0) * 100)}%</span>
                    <span>{formatRupiah(item.used_amount)} / {formatRupiah(item.budget_amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Progress tabungan</h3>
          </div>
          <div className="stack-list">
            {(health.savings_targets || []).length === 0 ? (
              <EmptyState title="Belum ada target tabungan" description="Buat target tabungan baru untuk memantau progres masa depan." />
            ) : (
              health.savings_targets.map((goal) => (
                <div key={goal.id} className="goal-card">
                  <div className="alert-header">
                    <strong>{goal.name}</strong>
                    <span>{goal.estimated_months_to_goal ? `${goal.estimated_months_to_goal} bulan` : 'Belum dihitung'}</span>
                  </div>
                  <ProgressBar percent={Math.min(100, (goal.progress || 0) * 100)} color="#10b981" />
                  <div className="pair-row">
                    <span>{formatPercent(goal.progress || 0)}</span>
                    <span>{formatRupiah(goal.current_amount)} / {formatRupiah(goal.target_amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function TransactionsPage({ token }) {
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ start: '', end: '', category: '', account: '', type: '' })
  const [draft, setDraft] = useState({
    account: '',
    user: '',
    type: 'expense',
    amount: '',
    currency: 'IDR',
    category: '',
    date: new Date().toISOString().slice(0, 16),
    description: '',
    related_account: '',
    is_approved: true,
    recurring_rule: '',
  })
  const [editingId, setEditingId] = useState(null)
  const [formError, setFormError] = useState('')

  const loadData = async () => {
    const [transactionsRes, accountsRes, categoriesRes] = await Promise.all([
      apiRequest('/api/transactions/', token),
      apiRequest('/api/accounts/', token),
      apiRequest('/api/categories/', token),
    ])

    if (transactionsRes.ok) setTransactions(await transactionsRes.json())
    if (accountsRes.ok) setAccounts(await accountsRes.json())
    if (categoriesRes.ok) setCategories(await categoriesRes.json())
  }

  useEffect(() => {
    loadData()
  }, [token])

  const resetDraft = () => {
    setDraft({
      account: '',
      user: '',
      type: 'expense',
      amount: '',
      currency: 'IDR',
      category: '',
      date: new Date().toISOString().slice(0, 16),
      description: '',
      related_account: '',
      is_approved: true,
      recurring_rule: '',
    })
    setEditingId(null)
    setFormError('')
  }

  const isTransfer = draft.type === 'transfer'

  const handleSubmit = async (event) => {
    event.preventDefault()

    const missing = []

    if (!draft.type) missing.push('jenis transaksi')
    if (!draft.amount || Number(draft.amount) <= 0) missing.push('jumlah')
    if (!draft.date) missing.push('tanggal & waktu')
    if (!draft.account) missing.push(isTransfer ? 'akun asal' : 'akun')
    if (isTransfer && !draft.related_account) missing.push('akun tujuan')

    if (missing.length > 0) {
      setFormError(`Field wajib belum diisi: ${missing.join(', ')}`)
      return
    }

    setFormError('')

    const payload = {
      ...draft,
      amount: Number(draft.amount),
      date: new Date(draft.date).toISOString(),
      user: null,
      category: isTransfer ? null : draft.category || null,
      related_account: draft.related_account || null,
      recurring_rule: draft.recurring_rule || null,
    }

    const url = editingId ? `/api/transactions/${editingId}/` : '/api/transactions/'
    const method = editingId ? 'PUT' : 'POST'
    const response = await apiRequest(url, token, {
      method,
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      resetDraft()
      loadData()
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setDraft({
      account: item.account ?? '',
      user: item.user ?? '',
      type: item.type || 'expense',
      amount: String(item.amount ?? ''),
      currency: item.currency || 'IDR',
      category: item.category ?? '',
      date: item.date ? new Date(item.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      description: item.description || '',
      related_account: item.related_account ?? '',
      is_approved: Boolean(item.is_approved),
      recurring_rule: item.recurring_rule || '',
    })
  }

  const [confirmModal, setConfirmModal] = useState(null)

  const handleDelete = async (id) => {
    setConfirmModal({
      title: 'Hapus transaksi',
      message: 'Transaksi ini akan dihapus permanen. Lanjutkan?',
      onConfirm: async () => {
        const response = await apiRequest(`/api/transactions/${id}/`, token, { method: 'DELETE' })
        if (response.ok) {
          loadData()
        }
        setConfirmModal(null)
      },
    })
  }

  const filtered = transactions.filter((item) => {
    const start = filters.start ? new Date(filters.start) : null
    const end = filters.end ? new Date(filters.end) : null
    const when = new Date(item.date)

    return (
      (!start || when >= start) &&
      (!end || when <= end) &&
      (!filters.category || String(item.category) === String(filters.category)) &&
      (!filters.account || String(item.account) === String(filters.account)) &&
      (!filters.type || item.type === filters.type)
    )
  })

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Tambah transaksi</h3>
          <button className="secondary-btn" type="button" onClick={() => window.open('/api/transactions/export/csv/', '_blank')}>Export CSV</button>
        </div>
        <form className="transaction-form" onSubmit={handleSubmit}>
          <div className="form-section required-section">
            <div className="section-title">Field wajib</div>
            <div className="form-grid">
              <div className="field-group">
                <div className="field-label-row">
                  <label>Jenis transaksi</label>
                  <span className="required-mark">Wajib</span>
                </div>
                <select value={draft.type} onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value, category: e.target.value === 'transfer' ? '' : prev.category }))}>
                  <option value="income">Pemasukan</option>
                  <option value="expense">Pengeluaran</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <label>Jumlah</label>
                  <span className="required-mark">Wajib</span>
                </div>
                <input type="number" min="0" step="1000" placeholder="Jumlah" value={draft.amount} onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))} />
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <label>Tanggal & waktu</label>
                  <span className="required-mark">Wajib</span>
                </div>
                <input type="datetime-local" value={draft.date} onChange={(e) => setDraft((prev) => ({ ...prev, date: e.target.value }))} />
              </div>

              {isTransfer ? (
                <>
                  <div className="field-group">
                    <div className="field-label-row">
                      <label>Dari akun</label>
                      <span className="required-mark">Wajib</span>
                    </div>
                    <select value={draft.account} onChange={(e) => setDraft((prev) => ({ ...prev, account: e.target.value }))}>
                      <option value="">Pilih akun asal</option>
                      {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </div>

                  <div className="field-group">
                    <div className="field-label-row">
                      <label>Ke akun</label>
                      <span className="required-mark">Wajib</span>
                    </div>
                    <select value={draft.related_account} onChange={(e) => setDraft((prev) => ({ ...prev, related_account: e.target.value }))}>
                      <option value="">Pilih akun tujuan</option>
                      {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div className="field-group">
                  <div className="field-label-row">
                    <label>Akun</label>
                    <span className="required-mark">Wajib</span>
                  </div>
                  <select value={draft.account} onChange={(e) => setDraft((prev) => ({ ...prev, account: e.target.value }))}>
                    <option value="">Pilih akun</option>
                    {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="form-section optional-section">
            <div className="section-title">Field opsional</div>
            <div className="form-grid">
              {!isTransfer && (
                <div className="field-group">
                  <label>Kategori</label>
                  <select value={draft.category} onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}>
                    <option value="">Pilih kategori</option>
                    {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
              )}

              {!isTransfer && (
                <div className="field-group">
                  <label>Akun terkait</label>
                  <select value={draft.related_account} onChange={(e) => setDraft((prev) => ({ ...prev, related_account: e.target.value }))}>
                    <option value="">Opsional</option>
                    {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
              )}

              <div className="field-group">
                <label>Catatan</label>
                <input type="text" placeholder="Catatan" value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
              </div>

              {!isTransfer && (
                <div className="field-group">
                  <label>Aturan berulang</label>
                  <input type="text" placeholder="Opsional" value={draft.recurring_rule} onChange={(e) => setDraft((prev) => ({ ...prev, recurring_rule: e.target.value }))} />
                </div>
              )}
            </div>
          </div>

          {isTransfer && (
            <div className="transfer-banner">
              Transfer: saldo akan dipindahkan dari akun asal ke akun tujuan.
            </div>
          )}

          {formError && (
            <div className="form-error">{formError}</div>
          )}

          <div className="form-actions">
            <button type="submit" className="primary-btn">{editingId ? 'Update transaksi' : isTransfer ? 'Simpan transfer' : 'Simpan transaksi'}</button>
            {editingId && (
              <button type="button" className="secondary-btn" onClick={resetDraft}>Batal</button>
            )}
          </div>
        </form>
      </section>

      <Modal
        open={Boolean(confirmModal)}
        title={confirmModal?.title || 'Konfirmasi'}
        message={confirmModal?.message || ''}
        onConfirm={confirmModal?.onConfirm || (() => setConfirmModal(null))}
        onCancel={() => setConfirmModal(null)}
        confirmText="Hapus"
      />

      <section className="panel">
        <div className="panel-header">
          <h3>Daftar transaksi</h3>
        </div>
        <div className="filter-grid">
          <input type="date" value={filters.start} onChange={(e) => setFilters((prev) => ({ ...prev, start: e.target.value }))} />
          <input type="date" value={filters.end} onChange={(e) => setFilters((prev) => ({ ...prev, end: e.target.value }))} />
          <select value={filters.category} onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}>
            <option value="">Semua kategori</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={filters.account} onChange={(e) => setFilters((prev) => ({ ...prev, account: e.target.value }))}>
            <option value="">Semua akun</option>
            {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}>
            <option value="">Semua tipe</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Deskripsi</th>
                <th>Kategori</th>
                <th>Akun</th>
                <th>Tipe</th>
                <th>Jumlah</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.date).toLocaleDateString('id-ID')}</td>
                  <td>{item.description || '-'}</td>
                  <td>{item.category_name || item.category || '-'}</td>
                  <td>{item.account_name || item.account || '-'}</td>
                  <td><span className={`badge ${item.type}`}>{item.type}</span></td>
                  <td className={item.type === 'income' ? 'positive' : 'negative'}>{formatRupiah(item.amount)}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="mini-btn" onClick={() => handleEdit(item)} title="Edit">✎</button>
                      <button type="button" className="mini-btn danger" onClick={() => handleDelete(item.id)} title="Hapus">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function BudgetsPage({ token }) {
  const [budgets, setBudgets] = useState([])
  const [alerts, setAlerts] = useState([])
  const [categories, setCategories] = useState([])
  const [draft, setDraft] = useState({ name: '', category: '', period: 'monthly', amount: '', start_date: '', end_date: '' })
  const [editingId, setEditingId] = useState(null)

  const loadData = async () => {
    const [budgetsRes, alertsRes, categoriesRes] = await Promise.all([
      apiRequest('/api/budgets/', token),
      apiRequest('/api/alerts/budgets/?threshold=0.8', token),
      apiRequest('/api/categories/', token),
    ])
    if (budgetsRes.ok) setBudgets(await budgetsRes.json())
    if (alertsRes.ok) setAlerts(await alertsRes.json())
    if (categoriesRes.ok) setCategories(await categoriesRes.json())
  }

  useEffect(() => {
    loadData()
  }, [token])

  const resetDraft = () => {
    setDraft({ name: '', category: '', period: 'monthly', amount: '', start_date: '', end_date: '' })
    setEditingId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!draft.name || !draft.category || !draft.amount) return

    const payload = {
      ...draft,
      amount: Number(draft.amount),
      category: Number(draft.category),
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
    }

    const url = editingId ? `/api/budgets/${editingId}/` : '/api/budgets/'
    const method = editingId ? 'PUT' : 'POST'
    const response = await apiRequest(url, token, {
      method,
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      resetDraft()
      loadData()
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setDraft({
      name: item.name || '',
      category: String(item.category ?? ''),
      period: item.period || 'monthly',
      amount: String(item.amount || ''),
      start_date: item.start_date || '',
      end_date: item.end_date || '',
    })
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Apakah Anda yakin ingin menghapus anggaran ini?')
    if (!confirmed) return

    const response = await apiRequest(`/api/budgets/${id}/`, token, { method: 'DELETE' })
    if (response.ok) loadData()
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Buat anggaran</h3>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <input type="text" placeholder="Nama anggaran" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
          <select value={draft.category} onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}>
            <option value="">Pilih kategori</option>
            {categories.filter((item) => item.type === 'expense').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={draft.period} onChange={(e) => setDraft((prev) => ({ ...prev, period: e.target.value }))}>
            <option value="monthly">Bulanan</option>
            <option value="weekly">Mingguan</option>
            <option value="yearly">Tahunan</option>
          </select>
          <input type="number" min="0" step="5000" placeholder="Jumlah anggaran" value={draft.amount} onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))} />
          <input type="date" value={draft.start_date} onChange={(e) => setDraft((prev) => ({ ...prev, start_date: e.target.value }))} />
          <input type="date" value={draft.end_date} onChange={(e) => setDraft((prev) => ({ ...prev, end_date: e.target.value }))} />
          <button type="submit" className="primary-btn">{editingId ? 'Update anggaran' : 'Simpan anggaran'}</button>
          {editingId && (
            <button type="button" className="secondary-btn" onClick={resetDraft}>Batal</button>
          )}
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Anggaran</h3>
        </div>
        <div className="stack-list">
          {budgets.map((budget) => {
            const alert = alerts.find((item) => item.budget_id === budget.id)
            const percent = alert ? (alert.percent_used || 0) * 100 : 0
            return (
              <div key={budget.id} className="budget-card">
                <div className="alert-header">
                  <strong>{budget.name || 'Anggaran'}</strong>
                  <span>{alert ? alert.status : 'normal'}</span>
                </div>
                <div className="pair-row">
                  <span>{formatRupiah(budget.amount)}</span>
                  <span>{Math.round(percent)}%</span>
                </div>
                <ProgressBar percent={Math.min(100, percent)} color={alert ? '#f59e0b' : '#10b981'} />
                <div className="row-actions compact-actions">
                  <button type="button" className="mini-btn" onClick={() => handleEdit(budget)} title="Edit">✎</button>
                  <button type="button" className="mini-btn danger" onClick={() => handleDelete(budget.id)} title="Hapus">🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function SavingsPage({ token }) {
  const [goals, setGoals] = useState([])
  const [accounts, setAccounts] = useState([])
  const [draft, setDraft] = useState({
    name: '',
    target_amount: '',
    current_amount: '',
    target_date: '',
    account: '',
  })
  const [editingId, setEditingId] = useState(null)

  const loadData = async () => {
    const [savingsRes, accountsRes] = await Promise.all([
      apiRequest('/api/savings/', token),
      apiRequest('/api/accounts/', token),
    ])

    if (savingsRes.ok) setGoals(await savingsRes.json())
    if (accountsRes.ok) setAccounts(await accountsRes.json())
  }

  useEffect(() => {
    loadData()
  }, [token])

  const resetDraft = () => {
    setDraft({ name: '', target_amount: '', current_amount: '', target_date: '', account: '' })
    setEditingId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!draft.name || !draft.target_amount) return

    const payload = {
      ...draft,
      target_amount: Number(draft.target_amount),
      current_amount: Number(draft.current_amount || 0),
      target_date: draft.target_date || null,
      account: draft.account ? Number(draft.account) : null,
    }

    const url = editingId ? `/api/savings/${editingId}/` : '/api/savings/'
    const method = editingId ? 'PUT' : 'POST'
    const response = await apiRequest(url, token, {
      method,
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      resetDraft()
      loadData()
    }
  }

  const handleEdit = (goal) => {
    setEditingId(goal.id)
    setDraft({
      name: goal.name || '',
      target_amount: String(goal.target_amount || ''),
      current_amount: String(goal.current_amount || ''),
      target_date: goal.target_date || '',
      account: goal.account ? String(goal.account) : '',
    })
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Apakah Anda yakin ingin menghapus target tabungan ini?')
    if (!confirmed) return

    const response = await apiRequest(`/api/savings/${id}/`, token, { method: 'DELETE' })
    if (response.ok) loadData()
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Tambah target tabungan</h3>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <input type="text" placeholder="Nama target" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
          <input type="number" min="0" step="1000" placeholder="Target nominal" value={draft.target_amount} onChange={(e) => setDraft((prev) => ({ ...prev, target_amount: e.target.value }))} />
          <input type="number" min="0" step="1000" placeholder="Jumlah saat ini" value={draft.current_amount} onChange={(e) => setDraft((prev) => ({ ...prev, current_amount: e.target.value }))} />
          <input type="date" value={draft.target_date} onChange={(e) => setDraft((prev) => ({ ...prev, target_date: e.target.value }))} />
          <select value={draft.account} onChange={(e) => setDraft((prev) => ({ ...prev, account: e.target.value }))}>
            <option value="">Pilih rekening simpanan</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
          <button type="submit" className="primary-btn">{editingId ? 'Update target' : 'Simpan target'}</button>
          {editingId && (
            <button type="button" className="secondary-btn" onClick={resetDraft}>Batal</button>
          )}
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Target tabungan</h3>
        </div>
        <div className="stack-list">
          {goals.map((goal) => {
            const selectedAccount = accounts.find((account) => account.id === goal.account)
            const progress = (Number(goal.current_amount || 0) / Math.max(Number(goal.target_amount || 1), 1)) * 100
            return (
              <div key={goal.id} className="goal-card">
                <div className="alert-header">
                  <strong>{goal.name}</strong>
                  <span>{formatPercent(progress / 100)}</span>
                </div>
                <ProgressBar percent={Math.min(100, progress)} color="#10b981" />
                <div className="pair-row">
                  <span>{formatRupiah(goal.current_amount)}</span>
                  <span>{formatRupiah(goal.target_amount)}</span>
                </div>
                <div className="pair-row">
                  <span>Rekening</span>
                  <span>{selectedAccount ? selectedAccount.name : 'Belum ditentukan'}</span>
                </div>
                <div className="row-actions compact-actions">
                  <button type="button" className="mini-btn" onClick={() => handleEdit(goal)} title="Edit">✎</button>
                  <button type="button" className="mini-btn danger" onClick={() => handleDelete(goal.id)} title="Hapus">🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function ReportsPage({ token }) {
  const [report, setReport] = useState({ total_income: '0', total_expense: '0', net: '0', budget_remaining: '0', by_category: [] })
  const [filters, setFilters] = useState({ period: 'monthly', start: '', end: '' })

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams({ period: filters.period || 'monthly' })
      if (filters.start) params.set('start', filters.start)
      if (filters.end) params.set('end', filters.end)
      const res = await apiRequest(`/api/reports/summary/?${params.toString()}`, token)
      if (res.ok) setReport(await res.json())
    }
    load()
  }, [token, filters])

  const exportExcel = async () => {
    const params = new URLSearchParams({ period: filters.period || 'monthly', format: 'excel' })
    if (filters.start) params.set('start', filters.start)
    if (filters.end) params.set('end', filters.end)
    const res = await apiRequest(`/api/reports/export/?${params.toString()}`, token)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'report.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Laporan</h3>
          <button className="secondary-btn" type="button" onClick={exportExcel}>Export Excel</button>
        </div>
        <div className="filter-grid">
          <select value={filters.period} onChange={(e) => setFilters((prev) => ({ ...prev, period: e.target.value }))}>
            <option value="monthly">Bulanan</option>
            <option value="yearly">Tahunan</option>
          </select>
          <input type="date" value={filters.start} onChange={(e) => setFilters((prev) => ({ ...prev, start: e.target.value }))} />
          <input type="date" value={filters.end} onChange={(e) => setFilters((prev) => ({ ...prev, end: e.target.value }))} />
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Total pemasukan" value={formatRupiah(report.total_income)} tone="income" />
        <StatCard label="Total pengeluaran" value={formatRupiah(report.total_expense)} tone="expense" />
        <StatCard label="Net" value={formatRupiah(report.net)} tone="balance" />
        <StatCard label="Sisa anggaran" value={formatRupiah(report.budget_remaining)} tone="balance" />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Per kategori</h3>
        </div>
        <div className="stack-list">
          {(report.by_category || []).map((item) => (
            <div key={item.category} className="goal-card">
              <div className="pair-row">
                <strong>{item.category}</strong>
                <span>{formatRupiah(item.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function AccountsPage({ token }) {
  const [accounts, setAccounts] = useState([])
  const [draft, setDraft] = useState({ name: '', type: 'cash', currency: 'IDR', starting_balance: '0', owner: '' })
  const [editingId, setEditingId] = useState(null)

  const loadData = async () => {
    const res = await apiRequest('/api/accounts/', token)
    if (res.ok) {
      const data = await res.json()
      setAccounts(Array.isArray(data) ? data : [])
    }
  }

  useEffect(() => {
    loadData()
  }, [token])

  const resetDraft = () => {
    setDraft({ name: '', type: 'cash', currency: 'IDR', starting_balance: '0', owner: '' })
    setEditingId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!draft.name) return

    const payload = {
      ...draft,
      starting_balance: Number(draft.starting_balance || 0),
    }

    const url = editingId ? `/api/accounts/${editingId}/` : '/api/accounts/'
    const method = editingId ? 'PUT' : 'POST'
    const response = await apiRequest(url, token, {
      method,
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      resetDraft()
      loadData()
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setDraft({
      name: item.name || '',
      type: item.type || 'cash',
      currency: item.currency || 'IDR',
      starting_balance: String(item.starting_balance || 0),
      owner: item.owner || '',
    })
  }

  const [confirmModal, setConfirmModal] = useState(null)

  const handleDelete = async (id) => {
    setConfirmModal({
      title: 'Hapus rekening',
      message: 'Semua data rekening ini akan dihapus. Lanjutkan?',
      onConfirm: async () => {
        const response = await apiRequest(`/api/accounts/${id}/`, token, { method: 'DELETE' })
        if (response.ok) loadData()
        setConfirmModal(null)
      },
    })
  }

  const handleResetBalance = async (id) => {
    setConfirmModal({
      title: 'Reset saldo rekening',
      message: 'Semua transaksi pada rekening ini akan dihapus dan saldo kembali ke 0. Lanjutkan?',
      onConfirm: async () => {
        const response = await apiRequest(`/api/accounts/${id}/reset-balance/`, token, { method: 'POST' })
        if (response.ok) {
          loadData()
        }
        setConfirmModal(null)
      },
    })
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Tambah rekening</h3>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <input type="text" placeholder="Nama rekening" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
          <select value={draft.type} onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}>
            <option value="cash">Tunai</option>
            <option value="bank">Bank</option>
            <option value="e_wallet">E-Wallet</option>
          </select>
          <input type="text" placeholder="Mata uang" value={draft.currency} onChange={(e) => setDraft((prev) => ({ ...prev, currency: e.target.value }))} />
          <input type="number" placeholder="Saldo awal" value={draft.starting_balance} onChange={(e) => setDraft((prev) => ({ ...prev, starting_balance: e.target.value }))} />
          <button type="submit" className="primary-btn">{editingId ? 'Update rekening' : 'Simpan rekening'}</button>
          {editingId && (
            <button type="button" className="secondary-btn" onClick={resetDraft}>Batal</button>
          )}
        </form>
      </section>

      <Modal
        open={Boolean(confirmModal)}
        title={confirmModal?.title || 'Konfirmasi'}
        message={confirmModal?.message || ''}
        onConfirm={confirmModal?.onConfirm || (() => setConfirmModal(null))}
        onCancel={() => setConfirmModal(null)}
      />

      <section className="panel">
        <div className="panel-header">
          <h3>Rekening & saldo</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Tipe</th>
                <th>Mata Uang</th>
                <th>Saldo Awal</th>
                <th>Pemilik</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.type}</td>
                  <td>{item.currency}</td>
                  <td>{formatRupiah(item.starting_balance)}</td>
                  <td>{item.owner || '-'}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="mini-btn" onClick={() => handleEdit(item)} title="Edit">✎</button>
                      <button type="button" className="mini-btn" onClick={() => handleResetBalance(item.id)} title="Reset saldo" aria-label="Reset saldo">↺</button>
                      <button type="button" className="mini-btn danger" onClick={() => handleDelete(item.id)} title="Hapus">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function CategoriesPage({ token }) {
  const [categories, setCategories] = useState([])
  const [draft, setDraft] = useState({ name: '', type: 'expense', parent: '' })
  const [editingId, setEditingId] = useState(null)

  const loadData = async () => {
    const res = await apiRequest('/api/categories/', token)
    if (res.ok) {
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    }
  }

  useEffect(() => {
    loadData()
  }, [token])

  const resetDraft = () => {
    setDraft({ name: '', type: 'expense', parent: '' })
    setEditingId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!draft.name) return

    const payload = {
      ...draft,
      parent: draft.parent || null,
    }

    const url = editingId ? `/api/categories/${editingId}/` : '/api/categories/'
    const method = editingId ? 'PUT' : 'POST'
    const response = await apiRequest(url, token, {
      method,
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      resetDraft()
      loadData()
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setDraft({
      name: item.name || '',
      type: item.type || 'expense',
      parent: item.parent ?? '',
    })
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Apakah Anda yakin ingin menghapus kategori ini?')
    if (!confirmed) return

    const response = await apiRequest(`/api/categories/${id}/`, token, { method: 'DELETE' })
    if (response.ok) loadData()
  }

  const grouped = {
    income: categories.filter((item) => item.type === 'income'),
    expense: categories.filter((item) => item.type === 'expense'),
    transfer: categories.filter((item) => item.type === 'transfer'),
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Tambah kategori</h3>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <input type="text" placeholder="Nama kategori" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
          <select value={draft.type} onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
            <option value="transfer">Transfer</option>
          </select>
          <select value={draft.parent} onChange={(e) => setDraft((prev) => ({ ...prev, parent: e.target.value }))}>
            <option value="">Kategori utama</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button type="submit" className="primary-btn">{editingId ? 'Update kategori' : 'Simpan kategori'}</button>
          {editingId && (
            <button type="button" className="secondary-btn" onClick={resetDraft}>Batal</button>
          )}
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Kategori</h3>
        </div>
        <div className="resource-grid">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="resource-card">
              <h4>{type === 'income' ? 'Pemasukan' : type === 'expense' ? 'Pengeluaran' : 'Transfer'}</h4>
              <div className="stack-list">
                {items.length === 0 ? <p className="empty-state">Belum ada kategori.</p> : items.map((item) => (
                  <div key={item.id} className="mini-resource">
                    <strong>{item.name}</strong>
                    <small>{item.parent ? `Subkategori` : 'Kategori utama'}</small>
                    <div className="row-actions compact-actions">
                      <button type="button" className="mini-btn" onClick={() => handleEdit(item)} title="Edit">✎</button>
                      <button type="button" className="mini-btn danger" onClick={() => handleDelete(item.id)} title="Hapus">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}


function AssetsPage({ token }) {
  const [assets, setAssets] = useState([])
  const [categories, setCategories] = useState([])
  const [draft, setDraft] = useState({ name: '', category: '', acquisition_date: '', acquisition_value: '', current_value: '', currency: 'IDR', description: '', status: 'active' })
  const [editingId, setEditingId] = useState(null)
  const [assetsFormError, setAssetsFormError] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')

  const loadData = async () => {
    const [assetsRes, categoriesRes] = await Promise.all([
      apiRequest('/api/assets/', token),
      apiRequest('/api/asset-categories/', token),
    ])

    const cats = categoriesRes.ok ? (await categoriesRes.json()) : []
    if (categoriesRes.ok) setCategories(cats)
    if (assetsRes.ok) {
      const raw = await assetsRes.json()
      const list = Array.isArray(raw) ? raw : []
      const mapped = list.map((it) => ({
        ...it,
        category_name: (cats.find((c) => c.id === it.category)?.name) || null,
      }))
      setAssets(mapped)
    }
  }

  useEffect(() => { loadData() }, [token])

  const resetDraft = () => {
    setDraft({ name: '', category: '', acquisition_date: '', acquisition_value: '', current_value: '', currency: 'IDR', description: '', status: 'active' })
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!draft.name) return
    setAssetsFormError('')

    const payload = {
      ...draft,
      acquisition_value: Number(draft.acquisition_value || 0),
      current_value: Number(draft.current_value || 0),
      category: draft.category || null,
      acquisition_date: draft.acquisition_date || null,
    }

    const url = editingId ? `/api/assets/${editingId}/` : '/api/assets/'
    const method = editingId ? 'PUT' : 'POST'
    const res = await apiRequest(url, token, { method, body: JSON.stringify(payload) })
    if (res.ok) {
      resetDraft(); loadData()
    } else {
      try {
        const data = await res.json()
        // show first error message if present
        if (typeof data === 'object') {
          const msgs = []
          for (const k of Object.keys(data)) {
            const v = data[k]
            if (Array.isArray(v)) msgs.push(`${k}: ${v.join(', ')}`)
            else msgs.push(`${k}: ${String(v)}`)
          }
          setAssetsFormError(msgs.join(' | '))
        } else {
          setAssetsFormError(String(data))
        }
      } catch (err) {
        setAssetsFormError('Gagal menyimpan aset')
      }
    }
  }

  const handleCreateCategory = async () => {
    setCategoryError('')
    if (!newCategoryName) return setCategoryError('Nama kategori wajib')
    const res = await apiRequest('/api/asset-categories/', token, { method: 'POST', body: JSON.stringify({ name: newCategoryName }) })
    if (res.ok) {
      const cat = await res.json()
      // reload categories and select the new one
      await loadData()
      setDraft((p) => ({ ...p, category: cat.id }))
      setNewCategoryName('')
    } else {
      try {
        const data = await res.json()
        setCategoryError((data && data.name) ? data.name.join(', ') : 'Gagal membuat kategori')
      } catch {
        setCategoryError('Gagal membuat kategori')
      }
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setDraft({
      name: item.name || '',
      category: item.category || '',
      acquisition_date: item.acquisition_date || '',
      acquisition_value: item.acquisition_value || '',
      current_value: item.current_value || '',
      currency: item.currency || 'IDR',
      description: item.description || '',
      status: item.status || 'active',
    })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus aset ini?')) return
    const res = await apiRequest(`/api/assets/${id}/`, token, { method: 'DELETE' })
    if (res.ok) loadData()
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Tambah / Edit Aset</h3>
        </div>
        <form className="stack-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field-row full-width">
              <input className="input-name" placeholder="Nama aset" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
              <input type="date" className="input-date" value={draft.acquisition_date} onChange={(e) => setDraft((p) => ({ ...p, acquisition_date: e.target.value }))} />
              <input className="input-value" placeholder="Nilai perolehan" value={draft.acquisition_value} onChange={(e) => setDraft((p) => ({ ...p, acquisition_value: e.target.value }))} />
              <input className="input-value" placeholder="Nilai saat ini" value={draft.current_value} onChange={(e) => setDraft((p) => ({ ...p, current_value: e.target.value }))} />
              <select className="input-status" value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}>
                <option value="active">Aktif</option>
                <option value="sold">Dijual</option>
                <option value="depreciated">Disusutkan</option>
                <option value="donated">Dihibahkan</option>
              </select>
              <input className="input-desc" placeholder="Keterangan (opsional)" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
              <div className="inline-actions">
                <button className="primary-btn" type="submit">{editingId ? 'Update Aset' : 'Tambah Aset'}</button>
                {editingId && <button type="button" className="secondary-btn" onClick={resetDraft}>Batal</button>}
              </div>
            </div>
          </div>

          <div className="form-grid">
            <div className="field-group full-width">
              <label>Kategori</label>
              <div className="category-chips">
                {categories.map((c) => (
                  <button key={c.id} type="button" className={`category-chip ${String(draft.category) === String(c.id) ? 'selected' : ''}`} onClick={() => setDraft((p) => ({ ...p, category: c.id }))}>
                    {c.name}
                  </button>
                ))}
              </div>
              {/* select kategori dihapus — gunakan chips untuk memilih cepat */}
              <div className="small-input-row">
                <input className="small" placeholder="Tambah kategori..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                <button type="button" className="secondary-btn small" onClick={handleCreateCategory}>Tambah</button>
              </div>
              {categoryError && <div className="field-error">{categoryError}</div>}
            </div>
          </div>
          {assetsFormError && <div className="form-error">{assetsFormError}</div>}
        </form>
      </section>

      <section className="panel">
        <div className="panel-header"><h3>Daftar Aset</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kategori</th>
                <th>Perolehan</th>
                <th>Saat ini</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td><NavLink to={`/assets/${a.id}`}>{a.name}</NavLink></td>
                  <td>{a.category_name || a.category || '-'}</td>
                  <td>{formatRupiah(a.acquisition_value)}</td>
                  <td>{formatRupiah(a.current_value)}</td>
                  <td>{a.status}</td>
                  <td>
                    <div className="row-actions">
                      <button className="mini-btn" onClick={() => handleEdit(a)} title="Edit aset" aria-label="Edit aset">✎</button>
                      <button className="mini-btn danger" onClick={() => handleDelete(a.id)} title="Hapus aset" aria-label="Hapus aset">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}


function AssetDetailPage({ token }) {
  const { id } = useParams()
  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newValue, setNewValue] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await apiRequest(`/api/assets/${id}/`, token)
        if (!res.ok) throw new Error('Gagal memuat aset')
        const data = await res.json()
        if (active) {
          setAsset(data)
          setNewValue(data.current_value || '')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [id, token])

  if (loading) return <div className="page-state">Memuat aset...</div>
  if (error) return <div className="page-state error">{error}</div>
  if (!asset) return <div className="page-state">Aset tidak ditemukan.</div>

  const history = Array.isArray(asset.value_history) ? asset.value_history.slice().sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at)) : []
  const chartData = history.map((h) => ({ date: h.changed_at.slice(0, 10), value: Number(h.new_value) }))

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>{asset.name}</h3>
          <div className="meta detail-tag">Kategori: {asset.category_name || asset.category || '-'}</div>
        </div>
        <div className="detail-summary">
          <div className="detail-stat balance">
            <span>Nilai saat ini</span>
            <strong>{formatRupiah(asset.current_value)}</strong>
          </div>
          <div className="detail-stat">
            <span>Tanggal perolehan</span>
            <strong>{asset.acquisition_date || '-'}</strong>
          </div>
          <div className="detail-stat">
            <span>Status</span>
            <strong>{asset.status}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h3>Riwayat Nilai</h3></div>
        <div className="chart-box detail-chart-box">
          {chartData.length === 0 ? (
            <div className="empty-state-card compact-empty">
              <div className="empty-state-icon">•</div>
              <h4>Belum ada perubahan nilai</h4>
              <p>Catat nilai aset pertama kali agar grafik perkembangan bisa terlihat.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => formatRupiah(v)} />
                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="history-section">
          <h4 className="history-title">Daftar Riwayat</h4>
          {history.length === 0 ? (
            <p className="empty-state">Belum ada riwayat nilai.</p>
          ) : (
            <div className="table-wrap history-table">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Nilai Lama</th>
                    <th>Nilai Baru</th>
                    <th>Catatan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice().reverse().map((h) => (
                    <tr key={h.id}>
                      <td>{new Date(h.changed_at).toLocaleString('id-ID')}</td>
                      <td>{formatRupiah(h.old_value)}</td>
                      <td>{formatRupiah(h.new_value)}</td>
                      <td>{h.note || '-'}</td>
                      <td>
                        <div className="row-actions">
                          <button className="mini-btn danger" onClick={async () => {
                            if (!window.confirm('Hapus entri riwayat ini?')) return
                            const res = await apiRequest(`/api/asset-value-history/${h.id}/`, token, { method: 'DELETE' })
                            if (res.ok) {
                              const r = await apiRequest(`/api/assets/${id}/`, token)
                              if (r.ok) setAsset(await r.json())
                            } else {
                              alert('Gagal menghapus riwayat')
                            }
                          }} title="Hapus riwayat" aria-label="Hapus riwayat">🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h3>Catat Perubahan Nilai</h3></div>
        <form className="stack-form" onSubmit={async (e) => {
          e.preventDefault()
          const payload = { current_value: Number(newValue || 0), note: note || '' }
          const res = await apiRequest(`/api/assets/${id}/`, token, { method: 'PATCH', body: JSON.stringify(payload) })
          if (res.ok) {
            const updated = await res.json()
            setAsset(updated)
            setNote('')
            setNewValue(updated.current_value || '')
          } else {
            alert('Gagal menyimpan perubahan nilai')
          }
        }}>
          <div className="form-grid">
            <div className="field-group">
              <label>Nilai baru</label>
              <input type="number" step="0.01" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <div className="field-group">
              <label>Catatan (opsional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button className="primary-btn" type="submit">Simpan perubahan nilai</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function FamilyPage({ token }) {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])

  useEffect(() => {
    async function load() {
      const [usersRes, rolesRes] = await Promise.all([
        apiRequest('/api/users/', token),
        apiRequest('/api/roles/', token),
      ])

      if (usersRes.ok) setUsers(await usersRes.json())
      if (rolesRes.ok) setRoles(await rolesRes.json())
    }
    load()
  }, [token])

  const roleMap = Object.fromEntries((roles || []).map((role) => [role.id, role.name]))

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Anggota keluarga & peran</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Username</th>
                <th>Email</th>
                <th>Peran</th>
                <th>Hak akses</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.first_name || user.username} {user.last_name || ''}</td>
                  <td>{user.username}</td>
                  <td>{user.email || '-'}</td>
                  <td>{roleMap[user.role] || 'Belum diatur'}</td>
                  <td>
                    <span className="status-chip">{user.role ? 'Aktif' : 'Umum'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function AllowancesPage({ token }) {
  const [allowances, setAllowances] = useState([])
  const [users, setUsers] = useState([])
  const [draft, setDraft] = useState({ user: '', amount: '', frequency: 'monthly', next_date: '' })
  const [editingId, setEditingId] = useState(null)

  const loadData = async () => {
    const [allowancesRes, usersRes] = await Promise.all([
      apiRequest('/api/allowances/', token),
      apiRequest('/api/users/', token),
    ])

    if (allowancesRes.ok) setAllowances(await allowancesRes.json())
    if (usersRes.ok) setUsers(await usersRes.json())
  }

  useEffect(() => {
    loadData()
  }, [token])

  const resetDraft = () => {
    setDraft({ user: '', amount: '', frequency: 'monthly', next_date: '' })
    setEditingId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!draft.user || !draft.amount) return

    const payload = {
      ...draft,
      user: Number(draft.user),
      amount: Number(draft.amount),
      next_date: draft.next_date || null,
    }

    const url = editingId ? `/api/allowances/${editingId}/` : '/api/allowances/'
    const method = editingId ? 'PUT' : 'POST'
    const response = await apiRequest(url, token, {
      method,
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      resetDraft()
      loadData()
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setDraft({
      user: String(item.user ?? ''),
      amount: String(item.amount ?? ''),
      frequency: item.frequency || 'monthly',
      next_date: item.next_date || '',
    })
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Apakah Anda yakin ingin menghapus tunjangan ini?')
    if (!confirmed) return

    const response = await apiRequest(`/api/allowances/${id}/`, token, { method: 'DELETE' })
    if (response.ok) loadData()
  }

  const userMap = Object.fromEntries((users || []).map((user) => [user.id, user.username]))

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Tambah tunjangan</h3>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <select value={draft.user} onChange={(e) => setDraft((prev) => ({ ...prev, user: e.target.value }))}>
            <option value="">Pilih pengguna</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
          </select>
          <input type="number" min="0" step="1000" placeholder="Jumlah" value={draft.amount} onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))} />
          <select value={draft.frequency} onChange={(e) => setDraft((prev) => ({ ...prev, frequency: e.target.value }))}>
            <option value="monthly">Bulanan</option>
            <option value="weekly">Mingguan</option>
          </select>
          <input type="date" value={draft.next_date} onChange={(e) => setDraft((prev) => ({ ...prev, next_date: e.target.value }))} />
          <button type="submit" className="primary-btn">{editingId ? 'Update tunjangan' : 'Simpan tunjangan'}</button>
          {editingId && (
            <button type="button" className="secondary-btn" onClick={resetDraft}>Batal</button>
          )}
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Tunjangan & pendapatan rutin</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Jumlah</th>
                <th>Frekuensi</th>
                <th>Berikutnya</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {allowances.map((item) => (
                <tr key={item.id}>
                  <td>{userMap[item.user] || item.user || 'Tidak diketahui'}</td>
                  <td>{formatRupiah(item.amount)}</td>
                  <td>{item.frequency}</td>
                  <td>{item.next_date || '-'}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="mini-btn" onClick={() => handleEdit(item)} title="Edit">✎</button>
                      <button type="button" className="mini-btn danger" onClick={() => handleDelete(item.id)} title="Hapus">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function AppLayout({ auth, onLogout, theme, onToggleTheme }) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const titleMap = {
    '/': 'Dashboard',
    '/transactions': 'Transaksi',
    '/accounts': 'Rekening',
    '/categories': 'Kategori',
    '/assets': 'Aset',
    '/budgets': 'Anggaran',
    '/savings': 'Tabungan',
    '/family': 'Keluarga',
    '/allowances': 'Tunjangan',
    '/reports': 'Laporan',
  }

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${mobileMenuOpen ? 'open' : ''}`} onClick={() => setMobileMenuOpen(false)} />
      <Sidebar
        user={auth.user}
        onLogout={onLogout}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <main className="content-shell">
        <Topbar
          title={titleMap[location.pathname] || 'Dashboard'}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onToggleMenu={() => setMobileMenuOpen((prev) => !prev)}
          mobileMenuOpen={mobileMenuOpen}
        />
        <Routes>
          <Route path="/" element={<DashboardPage token={auth.token} />} />
          <Route path="/transactions" element={<TransactionsPage token={auth.token} />} />
          <Route path="/accounts" element={<AccountsPage token={auth.token} />} />
          <Route path="/categories" element={<CategoriesPage token={auth.token} />} />
          <Route path="/assets" element={<AssetsPage token={auth.token} />} />
          <Route path="/assets/:id" element={<AssetDetailPage token={auth.token} />} />
          <Route path="/budgets" element={<BudgetsPage token={auth.token} />} />
          <Route path="/savings" element={<SavingsPage token={auth.token} />} />
          <Route path="/family" element={<FamilyPage token={auth.token} />} />
          <Route path="/allowances" element={<AllowancesPage token={auth.token} />} />
          <Route path="/reports" element={<ReportsPage token={auth.token} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (auth?.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [auth])

  useEffect(() => {
    document.body.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const handleLogin = async (username, pin) => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/pin/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin_code: pin }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Login gagal')
      }

      setAuth({ token: data.token, user: data.user })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <BrowserRouter>
      {auth ? (
        <AppLayout auth={auth} onLogout={() => setAuth(null)} theme={theme} onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))} />
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleLogin} loading={loading} error={error} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}

