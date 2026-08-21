import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import {
  api,
  clearSession,
  getExpiresAt,
  getStoredUser,
  storeSession,
  type AuthResult,
  type AuthUser,
} from '@/lib/api'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, passwordConfirmation: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: (email: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const EXPIRY_WARNING_MS = 10 * 60 * 1000 // warn 10 minutes before expiry

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser())
  const [loading, setLoading] = useState(true)
  const warningShown = useRef(false)

  useEffect(() => {
    const token = localStorage.getItem('td_token')

    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    if (getExpiresAt() !== null && getExpiresAt()! < Date.now()) {
      clearSession()
      setUser(null)
      setLoading(false)
      return
    }

    api<{ data: AuthUser }>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const finishLogin = useCallback((result: AuthResult) => {
    storeSession(result)
    setUser(result.user)
    warningShown.current = false
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api<AuthResult>('/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      finishLogin(result)
    },
    [finishLogin],
  )

  const register = useCallback(
    async (name: string, email: string, password: string, passwordConfirmation: string) => {
      const result = await api<AuthResult>('/auth/register', {
        method: 'POST',
        body: {
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
        },
      })
      finishLogin(result)
    },
    [finishLogin],
  )

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // token may already be dead — clearing locally is what matters
    }
    clearSession()
    setUser(null)
  }, [])

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null)
      toast.error('Your session ended. Please sign in again.')
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)

    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  // Expiry countdown → friendly warning at T-10min.
  useEffect(() => {
    if (!user) return

    const timer = setInterval(() => {
      const expiresAt = getExpiresAt()
      if (expiresAt === null) return

      const remaining = expiresAt - Date.now()

      if (remaining <= 0) {
        clearSession()
        setUser(null)
        toast.info('Session expired after 60 minutes. Sign in to continue.')
        return
      }

      if (remaining <= EXPIRY_WARNING_MS && !warningShown.current) {
        warningShown.current = true
        toast.warning(`Session ends in ${Math.ceil(remaining / 60000)} minutes.`, {
          description:
            'Your work auto-saves locally. Re-enter your password when prompted to stay signed in.',
          duration: 12000,
        })
      }
    }, 30_000)

    return () => clearInterval(timer)
  }, [user])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refreshSession: login }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
