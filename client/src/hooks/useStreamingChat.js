import { useState, useCallback } from 'react'
import { API_BASE } from '../config'
import { getStoredToken } from '../api'

export function useStreamingChat(userId) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || isStreaming) return

      const userMessage = { role: 'user', content: text }
      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)

      const placeholderMessage = { role: 'assistant', content: '', toolResults: [] }
      setMessages((prev) => [...prev, placeholderMessage])

      try {
        const token = getStoredToken()
        const response = await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: userId, message: text }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue

            const jsonStr = trimmed.slice('data:'.length).trim()
            if (!jsonStr || jsonStr === '[DONE]') continue

            try {
              const event = JSON.parse(jsonStr)

              if (event.type === 'token') {
                setMessages((prev) => {
                  const next = [...prev]
                  const lastIdx = next.length - 1
                  next[lastIdx] = {
                    ...next[lastIdx],
                    content: next[lastIdx].content + (event.content ?? ''),
                  }
                  return next
                })
              } else if (event.type === 'done') {
                if (event.tool_results) {
                  setMessages((prev) => {
                    const next = [...prev]
                    const lastIdx = next.length - 1
                    next[lastIdx] = {
                      ...next[lastIdx],
                      toolResults: event.tool_results,
                    }
                    return next
                  })
                }
              }
            } catch {
              // ignore malformed SSE JSON
            }
          }
        }
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev]
          const lastIdx = next.length - 1
          next[lastIdx] = {
            ...next[lastIdx],
            content: `Error: ${err.message}`,
          }
          return next
        })
      } finally {
        setIsStreaming(false)
      }
    },
    [userId, isStreaming],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isStreaming, sendMessage, clearMessages }
}
