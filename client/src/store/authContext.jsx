import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  setStoredToken,
  clearStoredToken,
  getStoredToken,
} from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = getStoredToken()
    if (storedToken) {
      setToken(storedToken)
      getMe()
        .then((me) => setUser(me))
        .catch(() => {
          clearStoredToken()
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (name, pin) => {
    const data = await apiLogin(name, pin)
    setStoredToken(data.token)
    setToken(data.token)
    setUser({ id: data.user_id, name: data.name })
    return data
  }, [])

  const register = useCallback(async (name, pin) => {
    const data = await apiRegister(name, pin)
    setStoredToken(data.token)
    setToken(data.token)
    setUser({ id: data.user_id, name: data.name })
    return data
  }, [])

  const logout = useCallback(() => {
    clearStoredToken()
    setToken(null)
    setUser(null)
  }, [])

  const value = { user, token, loading, login, register, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
