const TOKEN_KEY = 'td_token'
const EXPIRY_KEY = 'td_expires_at'
const USER_KEY = 'td_user'

export interface AuthUser {
  id: number
  name: string
  email: string
}

export interface AuthResult {
  user: AuthUser
  token: string
  expires_at: string
}

export class ApiError extends Error {
  readonly status: number
  readonly errors?: Record<string, string[]>

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getExpiresAt(): number | null {
  const raw = localStorage.getItem(EXPIRY_KEY)
  return raw ? Number(raw) : null
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)

  if (raw === null) return null

  try {
    const parsed = JSON.parse(raw) as AuthUser

    return typeof parsed?.id === 'number' ? parsed : null
  } catch {
    // Corrupted storage must never take the whole app down.
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function storeSession(result: AuthResult): void {
  localStorage.setItem(TOKEN_KEY, result.token)
  localStorage.setItem(EXPIRY_KEY, String(new Date(result.expires_at).getTime()))
  localStorage.setItem(USER_KEY, JSON.stringify(result.user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
  localStorage.removeItem(USER_KEY)
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers = {}, ...rest } = options

  const token = getToken()

  const response = await fetch(`/api${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401 && !path.startsWith('/auth/')) {
    clearSession()
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    throw new ApiError(401, 'Session expired. Please sign in again.')
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    let errors: Record<string, string[]> | undefined

    try {
      const payload = await response.json()
      message = typeof payload.message === 'string' ? payload.message : message
      errors = payload.errors
    } catch {
      // non-JSON error body — keep default message
    }

    throw new ApiError(response.status, message, errors)
  }

  return (await response.json()) as T
}
