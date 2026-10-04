import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_BASE } from '../config'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

export function useWebSocket(userId, token) {
  const socketRef = useRef(null)
  const retriesRef = useRef(0)
  const unmountedRef = useRef(false)
  const [lastMessage, setLastMessage] = useState(null)
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    if (!userId || !token) return
    if (unmountedRef.current) return

    const url = `${WS_BASE}/ws/${userId}?token=${token}`
    const ws = new WebSocket(url)
    socketRef.current = ws

    ws.onopen = () => {
      if (unmountedRef.current) return
      setConnected(true)
      retriesRef.current = 0
    }

    ws.onmessage = (event) => {
      if (unmountedRef.current) return
      try {
        const parsed = JSON.parse(event.data)
        setLastMessage(parsed)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      setConnected(false)
      if (retriesRef.current < MAX_RETRIES) {
        retriesRef.current += 1
        setTimeout(connect, RETRY_DELAY_MS * retriesRef.current)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [userId, token])

  useEffect(() => {
    unmountedRef.current = false
    connect()

    return () => {
      unmountedRef.current = true
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [connect])

  const sendMessage = useCallback((data) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { lastMessage, sendMessage, connected }
}
