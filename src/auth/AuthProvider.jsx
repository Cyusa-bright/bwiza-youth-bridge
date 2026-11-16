import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, clearCsrfToken } from '../services/api'
import { AuthContext } from './AuthContext'

function getErrorMessage(error) {
  return error.response?.data?.error?.message || 'Unable to complete that request. Please try again.'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginOpen, setLoginOpen] = useState(false)
  const [authError, setAuthError] = useState('')

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data.user)
      setAuthError('')
      return response.data.user
    } catch (error) {
      if (error.response?.status === 401) {
        setUser(null)
        setAuthError('')
        return null
      }
      setAuthError(getErrorMessage(error))
      throw error
    } finally {
      // The session restore is an asynchronous effect and must settle the initial loading state.
      // oxlint-disable-next-line react/set-state-in-effect
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handleExpiredSession = () => setUser(null)
    window.addEventListener('byb:session-expired', handleExpiredSession)
    // Restore the server-backed session on initial mount; errors are exposed in authError.
    // oxlint-disable-next-line react/set-state-in-effect
    refreshUser().catch(() => {})
    return () => window.removeEventListener('byb:session-expired', handleExpiredSession)
  }, [refreshUser])

  const login = useCallback(async (credentials) => {
    const response = await api.post('/auth/login', credentials)
    setUser(response.data.user)
    setLoginOpen(false)
    setAuthError('')
    return response.data.user
  }, [])

  const register = useCallback(async (details) => {
    const response = await api.post('/auth/register', details)
    setUser(response.data.user)
    setLoginOpen(false)
    setAuthError('')
    return response.data.user
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout')
    setUser(null)
    clearCsrfToken()
  }, [])

  const updateProfile = useCallback(async (details) => {
    const response = await api.patch('/auth/profile', details)
    setUser(response.data.user)
    return response.data.user
  }, [])
  const openLogin = useCallback(() => setLoginOpen(true), [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])

  const value = useMemo(() => ({
    user,
    loading,
    loginOpen,
    authError,
    login,
    register,
    logout,
    refreshUser,
    updateProfile,
    openLogin,
    closeLogin,
    getErrorMessage,
  }), [user, loading, loginOpen, authError, login, register, logout, refreshUser, updateProfile, openLogin, closeLogin])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
