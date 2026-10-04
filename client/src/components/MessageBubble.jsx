import PropTypes from 'prop-types'

const TOOL_RESULT_ICONS = {
  event_created: '📅',
  expense_logged: '💰',
  priority_added: '⭐',
  default: '✓',
}

function ToolResultCard({ result }) {
  const icon = TOOL_RESULT_ICONS[result.type] ?? TOOL_RESULT_ICONS.default

  return (
    <div className="flex items-center gap-2 bg-surface-900 border border-surface-700 rounded-md px-3 py-1.5 text-xs text-surface-300 mt-1">
      <span aria-hidden="true">{icon}</span>
      <span>{result.message ?? result.type ?? 'Action completed'}</span>
    </div>
  )
}

ToolResultCard.propTypes = {
  result: PropTypes.shape({
    type: PropTypes.string,
    message: PropTypes.string,
  }).isRequired,
}

function MessageText({ content }) {
  const lines = content.split('\n')
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {lines.map((line, idx) => (
        <span key={idx}>
          {line}
          {idx < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  )
}

MessageText.propTypes = {
  content: PropTypes.string.isRequired,
}

export default function MessageBubble({ role, content, toolResults }) {
  const isUser = role === 'user'

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}
      role="article"
      aria-label={`${isUser ? 'Your' : 'Assistant'} message`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center shrink-0 mt-0.5 mr-2" aria-hidden="true">
          <span className="text-white text-xs font-bold">H</span>
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isUser
              ? 'bg-primary-600 text-white rounded-tr-sm'
              : 'bg-surface-800 text-surface-100 rounded-tl-sm'
          }`}
        >
          {content ? (
            <MessageText content={content} />
          ) : (
            <div className="flex items-center gap-1.5 py-0.5" aria-label="Thinking" role="status">
              <span className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-surface-400 rounded-full animate-bounce animation-delay-150" />
              <span className="w-2 h-2 bg-surface-400 rounded-full animate-bounce animation-delay-300" />
            </div>
          )}
        </div>

        {toolResults && toolResults.length > 0 && (
          <div className="flex flex-col gap-1 mt-1 w-full">
            {toolResults.map((result, idx) => (
              <ToolResultCard key={idx} result={result} />
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center shrink-0 mt-0.5 ml-2" aria-hidden="true">
          <span className="text-surface-300 text-xs font-bold">U</span>
        </div>
      )}
    </div>
  )
}

MessageBubble.propTypes = {
  role: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
  toolResults: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string,
      message: PropTypes.string,
    }),
  ),
}

MessageBubble.defaultProps = {
  toolResults: [],
}
