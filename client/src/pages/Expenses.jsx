import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../store/authContext'
import { getExpenses, createExpense, exportJson, exportCsv } from '../api'

const CATEGORIES = ['food', 'transport', 'utilities', 'entertainment', 'health', 'other']

const CATEGORY_STYLES = {
  food: { badge: 'bg-green-900 text-green-300 border-green-700', bar: 'bg-green-500' },
  transport: { badge: 'bg-blue-900 text-blue-300 border-blue-700', bar: 'bg-blue-500' },
  utilities: { badge: 'bg-yellow-900 text-yellow-300 border-yellow-700', bar: 'bg-yellow-500' },
  entertainment: { badge: 'bg-purple-900 text-purple-300 border-purple-700', bar: 'bg-purple-500' },
  health: { badge: 'bg-red-900 text-red-300 border-red-700', bar: 'bg-red-500' },
  other: { badge: 'bg-surface-800 text-surface-300 border-surface-600', bar: 'bg-surface-500' },
}

function getCategoryStyle(category) {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other
}

function calcCategoryTotals(expenses) {
  const totals = {}
  let grand = 0
  for (const exp of expenses) {
    const cat = exp.category ?? 'other'
    totals[cat] = (totals[cat] ?? 0) + Number(exp.amount ?? 0)
    grand += Number(exp.amount ?? 0)
  }
  return { totals, grand }
}

function formatAmount(amount) {
  return `₹${Number(amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatExpenseDate(dateStr) {
  try {
    return format(parseISO(dateStr), 'dd MMM')
  } catch {
    return dateStr ?? ''
  }
}

function getCurrentMonth() {
  return format(new Date(), 'yyyy-MM')
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function CategoryBadge({ category }) {
  const style = getCategoryStyle(category)
  return (
    <span className={`text-xs font-medium border rounded-full px-2 py-0.5 capitalize ${style.badge}`}>
      {category}
    </span>
  )
}

CategoryBadge.propTypes = {
  category: PropTypes.string.isRequired,
}

function BudgetSummary({ expenses }) {
  const { totals, grand } = calcCategoryTotals(expenses)

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-surface-300">Total Spend</span>
        <span className="text-lg font-bold text-white">{formatAmount(grand)}</span>
      </div>

      <div className="space-y-2">
        {CATEGORIES.filter((cat) => totals[cat]).map((cat) => {
          const amount = totals[cat] ?? 0
          const pct = grand > 0 ? (amount / grand) * 100 : 0
          const style = getCategoryStyle(cat)
          return (
            <div key={cat}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-surface-400 capitalize">{cat}</span>
                <span className="text-surface-300">{formatAmount(amount)} ({pct.toFixed(0)}%)</span>
              </div>
              <div className="h-1.5 w-full bg-surface-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${style.bar} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${cat}: ${pct.toFixed(0)}%`}
                />
              </div>
            </div>
          )
        })}
      </div>

      {grand === 0 && (
        <p className="text-surface-500 text-xs text-center mt-2">No expenses this month</p>
      )}
    </div>
  )
}

BudgetSummary.propTypes = {
  expenses: PropTypes.array.isRequired,
}

function ExpenseItem({ expense }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-800 last:border-0">
      <div className="w-10 h-10 bg-surface-800 rounded-xl flex items-center justify-center shrink-0">
        <span className="text-surface-400 text-xs font-medium">{formatExpenseDate(expense.date ?? expense.created_at)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{expense.description ?? 'Expense'}</p>
        <div className="mt-0.5">
          <CategoryBadge category={expense.category ?? 'other'} />
        </div>
      </div>
      <span className="text-sm font-semibold text-white shrink-0">{formatAmount(expense.amount)}</span>
    </div>
  )
}

ExpenseItem.propTypes = {
  expense: PropTypes.shape({
    id: PropTypes.string,
    amount: PropTypes.number,
    category: PropTypes.string,
    description: PropTypes.string,
    date: PropTypes.string,
    created_at: PropTypes.string,
  }).isRequired,
}

const EMPTY_EXPENSE_FORM = {
  amount: '',
  category: 'food',
  description: '',
  date: format(new Date(), 'yyyy-MM-dd'),
}

function AddExpenseForm({ userId, onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY_EXPENSE_FORM)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = useCallback((field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const amount = parseFloat(form.amount)
      if (!form.amount || isNaN(amount) || amount <= 0) {
        setError('Please enter a valid amount.')
        return
      }
      setError(null)
      setLoading(true)
      try {
        await createExpense({
          user_id: userId,
          amount,
          category: form.category,
          description: form.description.trim() || null,
          date: form.date,
        })
        setForm(EMPTY_EXPENSE_FORM)
        onCreated()
      } catch (err) {
        setError(err.message ?? 'Failed to add expense.')
      } finally {
        setLoading(false)
      }
    },
    [form, userId, onCreated],
  )

  const inputClass =
    'w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-surface-500'
  const labelClass = 'text-xs font-medium text-surface-400 mb-1 block'

  return (
    <form onSubmit={handleSubmit} className="bg-surface-800 border border-primary-700 rounded-xl p-4 space-y-3 mb-4">
      <h3 className="text-sm font-semibold text-white">New Expense</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="exp-amount" className={labelClass}>Amount (₹) *</label>
          <input
            id="exp-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={handleChange('amount')}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="exp-date" className={labelClass}>Date *</label>
          <input id="exp-date" type="date" value={form.date} onChange={handleChange('date')} className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="exp-category" className={labelClass}>Category *</label>
        <select id="exp-category" value={form.category} onChange={handleChange('category')} className={`${inputClass} appearance-none`}>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat} className="capitalize bg-surface-900">
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="exp-desc" className={labelClass}>Description</label>
        <input
          id="exp-desc"
          type="text"
          value={form.description}
          onChange={handleChange('description')}
          placeholder="What was this for?"
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="text-red-400 text-xs bg-red-950 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {loading ? 'Saving...' : 'Add Expense'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-surface-400 hover:text-white bg-surface-700 hover:bg-surface-600 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

AddExpenseForm.propTypes = {
  userId: PropTypes.string.isRequired,
  onCreated: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export default function Expenses() {
  const { user } = useAuth()
  const [month, setMonth] = useState(getCurrentMonth)
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [exporting, setExporting] = useState(null)

  const loadExpenses = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getExpenses(user.id, month)
      setExpenses(Array.isArray(data) ? data : data.expenses ?? [])
    } catch (err) {
      setError(err.message ?? 'Failed to load expenses.')
    } finally {
      setLoading(false)
    }
  }, [user?.id, month])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  const handleExportJson = useCallback(async () => {
    setExporting('json')
    try {
      const data = await exportJson(user.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      triggerDownload(blob, `hive-expenses-${month}.json`)
    } catch (err) {
      setError(err.message ?? 'Export failed.')
    } finally {
      setExporting(null)
    }
  }, [user.id, month])

  const handleExportCsv = useCallback(async () => {
    setExporting('csv')
    try {
      const blob = await exportCsv(user.id)
      triggerDownload(blob, `hive-expenses-${month}.csv`)
    } catch (err) {
      setError(err.message ?? 'Export failed.')
    } finally {
      setExporting(null)
    }
  }, [user.id, month])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Expenses</h1>
          <p className="text-sm text-surface-400 mt-0.5">Track your spending</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition-colors"
          aria-label="Add new expense"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      {/* Month picker + export */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1">
          <label htmlFor="month-picker" className="text-sm text-surface-400 whitespace-nowrap">
            Month:
          </label>
          <input
            id="month-picker"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportJson}
            disabled={exporting !== null}
            className="text-xs text-surface-400 hover:text-white bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
            aria-label="Export as JSON"
          >
            {exporting === 'json' ? 'Exporting...' : 'JSON'}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={exporting !== null}
            className="text-xs text-surface-400 hover:text-white bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
            aria-label="Export as CSV"
          >
            {exporting === 'csv' ? 'Exporting...' : 'CSV'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <AddExpenseForm
          userId={user.id}
          onCreated={() => { setShowForm(false); loadExpenses() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          <BudgetSummary expenses={expenses} />

          {expenses.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-surface-400 text-sm">No expenses for {month}</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-2 text-primary-400 hover:text-primary-300 text-sm underline"
              >
                Log your first expense
              </button>
            </div>
          ) : (
            <div className="bg-surface-900 border border-surface-800 rounded-xl px-4">
              {expenses.map((exp) => (
                <ExpenseItem key={exp.id ?? exp._id ?? `${exp.date}-${exp.amount}`} expense={exp} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
