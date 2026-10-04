// In production FastAPI serves both the API and the static files on the same
// host:port, so relative URLs work from any device on any network.
// In dev (Vite on :5173), VITE_API_BASE overrides to reach FastAPI on :8000.
export const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// WebSocket must be absolute — derive from the page's own host at runtime.
const _proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const _host = typeof window !== 'undefined' ? window.location.host : 'localhost:8000'
export const WS_BASE = import.meta.env.VITE_WS_BASE ?? `${_proto}//${_host}`
