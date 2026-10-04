import { API_BASE } from './config'

const TOKEN_KEY = 'hive_token'

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function apiFetch(path, options = {}) {
  const token = getStoredToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let message = `HTTP error ${response.status}`
    try {
      const errData = await response.json()
      message = errData.detail ?? errData.message ?? message
    } catch {
      // ignore json parse error on error body
    }
    throw new Error(message)
  }

  return response
}

export async function register(name, pin) {
  const response = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, pin }),
  })
  return response.json()
}

export async function login(name, pin) {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, pin }),
  })
  return response.json()
}

export async function getMe() {
  const response = await apiFetch('/auth/me')
  return response.json()
}

export async function getEvents(userId, fromDt, toDt) {
  const params = new URLSearchParams()
  if (fromDt) params.set('from_dt', fromDt)
  if (toDt) params.set('to_dt', toDt)
  const query = params.toString()
  const response = await apiFetch(`/events/${userId}${query ? `?${query}` : ''}`)
  return response.json()
}

export async function createEvent(data) {
  const response = await apiFetch('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function deleteEvent(eventId) {
  await apiFetch(`/events/${eventId}`, { method: 'DELETE' })
}

export async function getExpenses(userId, month) {
  const params = new URLSearchParams()
  if (month) params.set('month', month)
  const query = params.toString()
  const response = await apiFetch(`/expenses/${userId}${query ? `?${query}` : ''}`)
  return response.json()
}

export async function createExpense(data) {
  const response = await apiFetch('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function getPriorities(userId) {
  const response = await apiFetch(`/priorities/${userId}`)
  return response.json()
}

export async function refreshPriorities(userId) {
  const response = await apiFetch(`/priorities/refresh/${userId}`, {
    method: 'POST',
  })
  return response.json()
}

export async function exportJson(userId) {
  const response = await apiFetch(`/export/json/${userId}`)
  return response.json()
}

export async function exportCsv(userId) {
  const token = getStoredToken()
  const headers = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const response = await fetch(`${API_BASE}/export/csv/${userId}`, { headers })
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`)
  }
  return response.blob()
}

export async function transcribeVoice(audioBlob) {
  const token = getStoredToken()
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')

  const headers = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}/voice`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    let message = `HTTP error ${response.status}`
    try {
      const errData = await response.json()
      message = errData.detail ?? errData.message ?? message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  return response.json()
}
