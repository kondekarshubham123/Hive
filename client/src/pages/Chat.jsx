import { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useAuth } from '../store/authContext'
import { useStreamingChat } from '../hooks/useStreamingChat'
import { useVoice } from '../hooks/useVoice'
import { useWebSocket } from '../hooks/useWebSocket'
import MessageBubble from '../components/MessageBubble'

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}


function BriefingBanner({ content, onDismiss }) {
  return (
    <div
      role="status"
      className="mx-4 mt-3 flex items-start gap-3 bg-primary-950 border border-primary-800 rounded-xl p-3.5 text-sm text-primary-200"
    >
      <span className="text-primary-400 mt-0.5 shrink-0" aria-hidden="true">★</span>
      <p className="flex-1 leading-relaxed">{content}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-primary-400 hover:text-primary-200 transition-colors"
        aria-label="Dismiss briefing"
      >
        <XIcon />
      </button>
    </div>
  )
}

BriefingBanner.propTypes = {
  content: PropTypes.string.isRequired,
  onDismiss: PropTypes.func.isRequired,
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center">
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-xl">H</span>
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Hello, I am Hive</h2>
        <p className="text-surface-400 text-sm leading-relaxed max-w-xs">
          Your local AI life assistant. Ask me to schedule events, log expenses, or anything on your mind.
        </p>
      </div>
    </div>
  )
}

function buildWelcomePrompts() {
  return [
    'What does my day look like?',
    'Log an expense for lunch ₹150',
    'Schedule a meeting tomorrow at 2 PM',
    'What are my top priorities?',
  ]
}

export default function Chat() {
  const { user, token } = useAuth()
  const { messages, isStreaming, sendMessage, clearMessages } = useStreamingChat(user?.id)
  const { isRecording, startRecording, stopRecording, error: voiceError } = useVoice()
  const { lastMessage } = useWebSocket(user?.id, token)

  const [inputText, setInputText] = useState('')
  const [briefing, setBriefing] = useState(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (lastMessage?.type === 'briefing' && lastMessage.content) {
      setBriefing(lastMessage.content)
    }
  }, [lastMessage])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const text = inputText.trim()
      if (!text || isStreaming) return
      setInputText('')
      await sendMessage(text)
      inputRef.current?.focus()
    },
    [inputText, isStreaming, sendMessage],
  )

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e)
      }
    },
    [handleSubmit],
  )

  const handleMicMouseDown = useCallback(
    async (e) => {
      e.preventDefault()
      await startRecording()
    },
    [startRecording],
  )

  const handleMicRelease = useCallback(
    async (e) => {
      e.preventDefault()
      if (!isRecording) return
      setIsTranscribing(true)
      try {
        const transcribedText = await stopRecording()
        if (transcribedText?.trim()) {
          // Put text in input so the user can review/edit before sending
          setInputText(transcribedText.trim())
          inputRef.current?.focus()
        }
      } catch {
        // error already set in useVoice
      } finally {
        setIsTranscribing(false)
      }
    },
    [isRecording, stopRecording],
  )

  const handlePromptClick = useCallback(
    async (prompt) => {
      await sendMessage(prompt)
    },
    [sendMessage],
  )

  const prompts = buildWelcomePrompts()

  return (
    <div className="flex flex-col h-full">
      {/* Briefing banner */}
      {briefing && (
        <BriefingBanner content={briefing} onDismiss={() => setBriefing(null)} />
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full">
            <div className="flex-1">
              <EmptyState />
            </div>
            {/* Prompt suggestions */}
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptClick(prompt)}
                  disabled={isStreaming}
                  className="text-left text-xs text-surface-300 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-xl px-3 py-2.5 transition-colors leading-relaxed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 pt-4 pb-2 space-y-4">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                role={msg.role}
                content={msg.content}
                toolResults={msg.toolResults}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Voice status / error */}
      {isTranscribing && (
        <p role="status" className="text-primary-400 text-xs px-4 py-1 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
          Transcribing…
        </p>
      )}
      {voiceError && !isTranscribing && (
        <p role="alert" className="text-red-400 text-xs px-4 py-1">
          {voiceError}
        </p>
      )}

      {/* Input bar */}
      <div className="shrink-0 px-4 pb-4 pt-2 border-t border-surface-800 bg-surface-950">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 bg-surface-800 rounded-2xl border border-surface-700 focus-within:border-primary-600 transition-colors px-3 py-2"
        >
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Hive..."
            rows={1}
            aria-label="Message input"
            disabled={isStreaming}
            className="flex-1 bg-transparent text-white placeholder-surface-500 text-sm resize-none outline-none py-1 max-h-32 leading-relaxed disabled:opacity-60"
            style={{ minHeight: '28px' }}
          />
          <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
            {/* Mic button */}
            <button
              type="button"
              onMouseDown={handleMicMouseDown}
              onMouseUp={handleMicRelease}
              onTouchStart={handleMicMouseDown}
              onTouchEnd={handleMicRelease}
              disabled={isStreaming || isTranscribing}
              aria-label={
                isTranscribing ? 'Transcribing…'
                : isRecording ? 'Release to transcribe'
                : 'Hold to record voice message'
              }
              aria-pressed={isRecording}
              className={`p-1.5 rounded-xl transition-colors ${
                isTranscribing
                  ? 'bg-primary-700 text-white animate-pulse'
                  : isRecording
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'text-surface-400 hover:text-white hover:bg-surface-700'
              } disabled:opacity-40`}
            >
              <MicIcon />
            </button>

            {/* Send button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isStreaming}
              aria-label="Send message"
              className="p-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-surface-700 disabled:opacity-40 text-white transition-colors"
            >
              <SendIcon />
            </button>
          </div>
        </form>

        {messages.length > 0 && (
          <div className="flex justify-end mt-1.5">
            <button
              onClick={clearMessages}
              className="text-xs text-surface-500 hover:text-surface-300 transition-colors"
              aria-label="Clear conversation"
            >
              Clear conversation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
