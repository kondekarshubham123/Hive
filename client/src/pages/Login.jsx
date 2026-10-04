import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useAuth } from '../store/authContext'

const TAB_SIGNIN = 'signin'
const TAB_REGISTER = 'register'

const PIN_MAX_LENGTH = 4
const PIN_PATTERN = /^\d{1,4}$/

function validatePin(pin) {
  if (!pin) return 'PIN is required'
  if (!/^\d{4}$/.test(pin)) return 'PIN must be exactly 4 digits'
  return null
}

function validateRegistration(name, pin, confirmPin) {
  if (!name.trim()) return 'Name is required'
  const pinError = validatePin(pin)
  if (pinError) return pinError
  if (pin !== confirmPin) return 'PINs do not match'
  return null
}

function validateSignIn(name, pin) {
  if (!name.trim()) return 'Name is required'
  const pinError = validatePin(pin)
  if (pinError) return pinError
  return null
}

function InputField({ id, label, type, value, onChange, placeholder, maxLength, autoComplete }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-surface-300">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3.5 py-2.5 text-white placeholder-surface-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
      />
    </div>
  )
}

InputField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  maxLength: PropTypes.number,
  autoComplete: PropTypes.string,
}

InputField.defaultProps = {
  placeholder: '',
  maxLength: undefined,
  autoComplete: 'off',
}

function SignInForm({ onSuccess }) {
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handlePinChange = useCallback((e) => {
    const val = e.target.value
    if (val === '' || PIN_PATTERN.test(val)) setPin(val)
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const validationError = validateSignIn(name, pin)
      if (validationError) {
        setError(validationError)
        return
      }
      setError(null)
      setLoading(true)
      try {
        await login(name.trim(), pin)
        onSuccess()
      } catch (err) {
        setError(err.message ?? 'Sign in failed. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [name, pin, login, onSuccess],
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <InputField
        id="signin-name"
        label="Your Name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your name"
        autoComplete="username"
      />
      <InputField
        id="signin-pin"
        label="PIN"
        type="password"
        value={pin}
        onChange={handlePinChange}
        placeholder="4-digit PIN"
        maxLength={PIN_MAX_LENGTH}
        autoComplete="current-password"
      />

      {error && (
        <p role="alert" className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-950"
        aria-busy={loading}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}

SignInForm.propTypes = {
  onSuccess: PropTypes.func.isRequired,
}

function RegisterForm({ onSuccess }) {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handlePinChange = useCallback((setter) => (e) => {
    const val = e.target.value
    if (val === '' || PIN_PATTERN.test(val)) setter(val)
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const validationError = validateRegistration(name, pin, confirmPin)
      if (validationError) {
        setError(validationError)
        return
      }
      setError(null)
      setLoading(true)
      try {
        await register(name.trim(), pin)
        onSuccess()
      } catch (err) {
        setError(err.message ?? 'Registration failed. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [name, pin, confirmPin, register, onSuccess],
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <InputField
        id="register-name"
        label="Your Name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Alex"
        autoComplete="name"
      />
      <InputField
        id="register-pin"
        label="Create PIN"
        type="password"
        value={pin}
        onChange={handlePinChange(setPin)}
        placeholder="4-digit PIN"
        maxLength={PIN_MAX_LENGTH}
        autoComplete="new-password"
      />
      <InputField
        id="register-confirm-pin"
        label="Confirm PIN"
        type="password"
        value={confirmPin}
        onChange={handlePinChange(setConfirmPin)}
        placeholder="Repeat your PIN"
        maxLength={PIN_MAX_LENGTH}
        autoComplete="new-password"
      />

      {error && (
        <p role="alert" className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-950"
        aria-busy={loading}
      >
        {loading ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  )
}

RegisterForm.propTypes = {
  onSuccess: PropTypes.func.isRequired,
}

export default function Login() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(TAB_SIGNIN)

  const handleSuccess = useCallback(() => {
    navigate('/chat', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-primary-600/25">
            <span className="text-white font-bold text-2xl">H</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Hive</h1>
          <p className="text-surface-400 text-sm mt-1">Your local AI life assistant</p>
        </div>

        {/* Card */}
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-6 shadow-xl">
          {/* Tabs */}
          <div className="flex bg-surface-800 rounded-lg p-1 mb-6" role="tablist" aria-label="Authentication options">
            <button
              role="tab"
              aria-selected={activeTab === TAB_SIGNIN}
              aria-controls="panel-signin"
              onClick={() => setActiveTab(TAB_SIGNIN)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === TAB_SIGNIN
                  ? 'bg-surface-700 text-white shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              Sign In
            </button>
            <button
              role="tab"
              aria-selected={activeTab === TAB_REGISTER}
              aria-controls="panel-register"
              onClick={() => setActiveTab(TAB_REGISTER)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === TAB_REGISTER
                  ? 'bg-surface-700 text-white shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              New User
            </button>
          </div>

          {/* Panels */}
          <div
            id="panel-signin"
            role="tabpanel"
            hidden={activeTab !== TAB_SIGNIN}
          >
            {activeTab === TAB_SIGNIN && <SignInForm onSuccess={handleSuccess} />}
          </div>
          <div
            id="panel-register"
            role="tabpanel"
            hidden={activeTab !== TAB_REGISTER}
          >
            {activeTab === TAB_REGISTER && <RegisterForm onSuccess={handleSuccess} />}
          </div>
        </div>
      </div>
    </div>
  )
}
