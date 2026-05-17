import { useState, useCallback } from 'react'

const AUTH_URL = '/auth'  // relative — nginx proxies /auth/* to Traefik → auth-service
const TOKEN_KEY = 'lotgen_token'
const USER_KEY  = 'lotgen_user'

export interface AuthUser {
  username: string
  role:     string
  name?:    string
}

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

function loadUser(): AuthUser | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token || isExpired(token)) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      return null
    }
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useAuth() {
  const [user,  setUser]  = useState<AuthUser | null>(loadUser)
  const [error, setError] = useState<string | null>(null)
  const [busy,  setBusy]  = useState(false)

  const login = useCallback(async (username: string, password: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${AUTH_URL}/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.detail ?? 'Hibás felhasználónév vagy jelszó')
        return false
      }
      const { access_token, role } = await res.json()
      const u: AuthUser = { username, role }
      localStorage.setItem(TOKEN_KEY, access_token)
      localStorage.setItem(USER_KEY,  JSON.stringify(u))
      setUser(u)
      return true
    } catch {
      setError('A szerverhez nem sikerült csatlakozni')
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const getToken = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token && isExpired(token)) {
      logout()
      return null
    }
    return token
  }, [logout])

  return { user, error, busy, login, logout, getToken, isAuthenticated: !!user }
}
