import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { format, addDays, isToday, isTomorrow, parseISO } from 'date-fns'
import { useAuth } from '../store/authContext'
import { getEvents, createEvent, deleteEvent } from '../api'

function formatDateLabel(dateStr) {
  try {
    const date = parseISO(dateStr)
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    return format(date, 'EEEE, MMMM d')
  } catch {
    return dateStr
  }
}

function formatTimeRange(startDt, endDt) {
  try {
    const start = format(parseISO(startDt), 'h:mm a')
    const end = endDt ? format(parseISO(endDt), 'h:mm a') : null
    return end ? `${start} – ${end}` : start
  } catch {
    return startDt ?? ''
  }
}

function groupEventsByDate(events) {
  const groups = {}
  for (const event of events) {
    const dateKey = (event.start_dt ?? event.date ?? '').slice(0, 10)
    if (!dateKey) continue
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(event)
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

function buildDateRange() {
  const now = new Date()
  const from = format(now, "yyyy-MM-dd'T'HH:mm:ss")
  const to = format(addDays(now, 14), "yyyy-MM-dd'T'23:59:59")
  return { from, to }
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

const EMPTY_FORM = {
  title: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  start_time: '',
  end_time: '',
  description: '',
}

function EventCard({ event, onDelete }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      await onDelete(event.id ?? event._id)
    } finally {
      setDeleting(false)
    }
  }, [event, onDelete])

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-white truncate">{event.title}</h3>
          {event.shared && (
            <span className="shrink-0 text-xs bg-primary-900 text-primary-300 border border-primary-700 rounded-full px-2 py-0.5">
              Shared
            </span>
          )}
        </div>
        <p className="text-xs text-surface-400 mb-1">
          {formatTimeRange(event.start_dt, event.end_dt)}
        </p>
        {event.description && (
          <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">{event.description}</p>
        )}
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        aria-label={`Delete event: ${event.title}`}
        className="shrink-0 p-1.5 text-surface-500 hover:text-red-400 hover:bg-surface-700 rounded-lg transition-colors disabled:opacity-40 self-start"
      >
        {deleting ? (
          <div className="w-4 h-4 border border-surface-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <TrashIcon />
        )}
      </button>
    </div>
  )
}

EventCard.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.string,
    _id: PropTypes.string,
    title: PropTypes.string.isRequired,
    start_dt: PropTypes.string,
    end_dt: PropTypes.string,
    description: PropTypes.string,
    shared: PropTypes.bool,
  }).isRequired,
  onDelete: PropTypes.func.isRequired,
}

function AddEventForm({ userId, onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = useCallback((field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!form.title.trim() || !form.date || !form.start_time) {
        setError('Title, date, and start time are required.')
        return
      }
      setError(null)
      setLoading(true)
      try {
        const startDt = `${form.date}T${form.start_time}:00`
        const endDt = form.end_time ? `${form.date}T${form.end_time}:00` : null
        await createEvent({
          user_id: userId,
          title: form.title.trim(),
          start_dt: startDt,
          end_dt: endDt,
          description: form.description.trim() || null,
        })
        setForm(EMPTY_FORM)
        onCreated()
      } catch (err) {
        setError(err.message ?? 'Failed to create event.')
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
    <form onSubmit={handleSubmit} className="bg-surface-800 border border-primary-700 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white mb-3">New Event</h3>

      <div>
        <label htmlFor="event-title" className={labelClass}>Title *</label>
        <input id="event-title" type="text" value={form.title} onChange={handleChange('title')} placeholder="Event title" className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="event-date" className={labelClass}>Date *</label>
          <input id="event-date" type="date" value={form.date} onChange={handleChange('date')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="event-start" className={labelClass}>Start Time *</label>
          <input id="event-start" type="time" value={form.start_time} onChange={handleChange('start_time')} className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="event-end" className={labelClass}>End Time</label>
        <input id="event-end" type="time" value={form.end_time} onChange={handleChange('end_time')} className={inputClass} />
      </div>

      <div>
        <label htmlFor="event-desc" className={labelClass}>Description</label>
        <textarea id="event-desc" value={form.description} onChange={handleChange('description')} placeholder="Optional details..." rows={2} className={`${inputClass} resize-none`} />
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
          {loading ? 'Saving...' : 'Save Event'}
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

AddEventForm.propTypes = {
  userId: PropTypes.string.isRequired,
  onCreated: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export default function Planner() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const loadEvents = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const { from, to } = buildDateRange()
      const data = await getEvents(user.id, from, to)
      setEvents(Array.isArray(data) ? data : data.events ?? [])
    } catch (err) {
      setError(err.message ?? 'Failed to load events.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const handleDelete = useCallback(
    async (eventId) => {
      await deleteEvent(eventId)
      await loadEvents()
    },
    [loadEvents],
  )

  const grouped = groupEventsByDate(events)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Planner</h1>
          <p className="text-sm text-surface-400 mt-0.5">Next 14 days</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition-colors"
          aria-label="Add new event"
        >
          <PlusIcon />
          <span className="hidden sm:inline">Add Event</span>
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-6">
          <AddEventForm
            userId={user.id}
            onCreated={() => { setShowForm(false); loadEvents() }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-400 text-sm text-center">
          {error}
          <button onClick={loadEvents} className="block mx-auto mt-2 text-red-300 hover:text-white underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && grouped.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-surface-500" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <p className="text-surface-400 text-sm">No events in the next 14 days</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-primary-400 hover:text-primary-300 text-sm underline"
          >
            Add your first event
          </button>
        </div>
      )}

      {/* Event groups */}
      {!loading && !error && grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(([dateKey, dateEvents]) => (
            <section key={dateKey} aria-label={formatDateLabel(dateKey)}>
              <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                {formatDateLabel(dateKey)}
              </h2>
              <div className="space-y-2">
                {dateEvents.map((event) => (
                  <EventCard
                    key={event.id ?? event._id ?? `${dateKey}-${event.title}`}
                    event={event}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
