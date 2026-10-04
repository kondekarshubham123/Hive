import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useAuth } from '../store/authContext'
import { getPriorities, refreshPriorities } from '../api'

function getScoreColor(score) {
  if (score >= 0.7) return 'bg-green-500'
  if (score >= 0.4) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getScoreLabel(score) {
  if (score >= 0.7) return 'High'
  if (score >= 0.4) return 'Medium'
  return 'Low'
}

function getScoreLabelColor(score) {
  if (score >= 0.7) return 'text-green-400 bg-green-950 border-green-800'
  if (score >= 0.4) return 'text-yellow-400 bg-yellow-950 border-yellow-800'
  return 'text-red-400 bg-red-950 border-red-800'
}

function getRefTypeBadgeColor(refType) {
  const map = {
    event: 'text-blue-300 bg-blue-950 border-blue-800',
    expense: 'text-green-300 bg-green-950 border-green-800',
    task: 'text-purple-300 bg-purple-950 border-purple-800',
    note: 'text-zinc-300 bg-zinc-800 border-zinc-600',
  }
  return map[refType] ?? 'text-surface-300 bg-surface-800 border-surface-600'
}

function formatLastUpdated(timestamp) {
  if (!timestamp) return null
  try {
    return formatDistanceToNow(parseISO(timestamp), { addSuffix: true })
  } catch {
    return null
  }
}

function RefreshIcon({ spinning }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

RefreshIcon.propTypes = {
  spinning: PropTypes.bool,
}

RefreshIcon.defaultProps = {
  spinning: false,
}

function ScoreBar({ score }) {
  const pct = Math.min(Math.max(score * 100, 0), 100)
  const colorClass = getScoreColor(score)

  return (
    <div
      className="h-1.5 w-full bg-surface-700 rounded-full overflow-hidden mt-2"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Priority score: ${(score * 100).toFixed(0)}%`}
    >
      <div
        className={`h-full rounded-full ${colorClass} transition-all duration-700`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

ScoreBar.propTypes = {
  score: PropTypes.number.isRequired,
}

function PriorityCard({ rank, priority }) {
  const score = Number(priority.score ?? 0)
  const scoreLabelColor = getScoreLabelColor(score)
  const refBadgeColor = getRefTypeBadgeColor(priority.ref_type)

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
      <div className="flex items-start gap-3">
        {/* Rank number */}
        <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-surface-300">#{rank}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Title / identifier */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-white">
              {priority.title ?? priority.ref_id ?? `Item ${rank}`}
            </h3>
            {priority.ref_type && (
              <span className={`text-xs font-medium border rounded-full px-2 py-0.5 capitalize ${refBadgeColor}`}>
                {priority.ref_type}
              </span>
            )}
            <span className={`text-xs font-medium border rounded-full px-2 py-0.5 ml-auto ${scoreLabelColor}`}>
              {getScoreLabel(score)}
            </span>
          </div>

          {/* Reason */}
          {priority.reason && (
            <p className="text-xs text-surface-400 leading-relaxed">{priority.reason}</p>
          )}

          {/* Score bar */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1">
              <ScoreBar score={score} />
            </div>
            <span className="text-xs text-surface-500 shrink-0 w-8 text-right">
              {(score * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

PriorityCard.propTypes = {
  rank: PropTypes.number.isRequired,
  priority: PropTypes.shape({
    score: PropTypes.number,
    title: PropTypes.string,
    ref_id: PropTypes.string,
    ref_type: PropTypes.string,
    reason: PropTypes.string,
  }).isRequired,
}

export default function Priorities() {
  const { user } = useAuth()
  const [priorities, setPriorities] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const loadPriorities = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getPriorities(user.id)
      const items = Array.isArray(data) ? data : data.priorities ?? []
      setPriorities(items)
      setLastUpdated(data.updated_at ?? new Date().toISOString())
    } catch (err) {
      setError(err.message ?? 'Failed to load priorities.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadPriorities()
  }, [loadPriorities])

  const handleRefresh = useCallback(async () => {
    if (!user?.id || refreshing) return
    setRefreshing(true)
    setError(null)
    try {
      const data = await refreshPriorities(user.id)
      const items = Array.isArray(data) ? data : data.priorities ?? []
      setPriorities(items)
      setLastUpdated(data.updated_at ?? new Date().toISOString())
    } catch (err) {
      setError(err.message ?? 'Failed to refresh priorities.')
    } finally {
      setRefreshing(false)
    }
  }, [user?.id, refreshing])

  const timeAgo = formatLastUpdated(lastUpdated)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Priorities</h1>
          {timeAgo && (
            <p className="text-sm text-surface-500 mt-0.5">Updated {timeAgo}</p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 bg-surface-800 hover:bg-surface-700 border border-surface-700 text-surface-300 hover:text-white text-sm font-medium px-3.5 py-2 rounded-xl transition-colors disabled:opacity-50"
          aria-label="Refresh priorities"
          aria-busy={refreshing}
        >
          <RefreshIcon spinning={refreshing} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-400 text-sm mb-4 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={loadPriorities} className="text-red-300 hover:text-white underline whitespace-nowrap text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && priorities.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-surface-500" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <p className="text-surface-400 text-sm mb-2">No priorities yet</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-primary-400 hover:text-primary-300 text-sm underline disabled:opacity-50"
          >
            {refreshing ? 'Generating...' : 'Generate priorities'}
          </button>
        </div>
      )}

      {/* Priority list */}
      {!loading && !error && priorities.length > 0 && (
        <div className="space-y-3">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-surface-500 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>High (&gt;70%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Medium (40–70%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>Low (&lt;40%)</span>
            </div>
          </div>

          {priorities.map((priority, idx) => (
            <PriorityCard
              key={priority.id ?? priority.ref_id ?? idx}
              rank={idx + 1}
              priority={priority}
            />
          ))}
        </div>
      )}
    </div>
  )
}
