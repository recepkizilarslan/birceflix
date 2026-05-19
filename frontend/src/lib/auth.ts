export interface User {
  id: string
  email: string
  name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

export async function getMe(): Promise<User | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`auth/me -> ${res.status}`)
  return res.json() as Promise<User>
}

/**
 * The backend uses stable string codes so the UI can localise the
 * messages: 'email_taken' | 'invalid_credentials' | 'invalid_input' |
 * 'weak_password' | 'rate_limited'.
 */
export class AuthError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

async function postAuth(path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.ok) return
  // 429 comes from @fastify/rate-limit with a generic message — collapse
  // every shape of it into our stable code so i18n has one key to map.
  if (res.status === 429) throw new AuthError('rate_limited')
  // Try to read the structured error; fall back to a generic code.
  let code = 'request_failed'
  try {
    const data = await res.json() as { error?: string }
    if (data?.error) code = data.error
  } catch {
    // body wasn't JSON — leave the generic code
  }
  throw new AuthError(code)
}

export function registerWithPassword(input: { email: string; password: string; name?: string }) {
  return postAuth('/api/auth/register', input)
}

export function loginWithPassword(input: { email: string; password: string }) {
  return postAuth('/api/auth/login', input)
}

/** Best-effort display name. Falls back to email local-part. */
export function displayName(u: Pick<User, 'first_name' | 'last_name' | 'name' | 'email'>): string {
  const parts = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  if (parts) return parts
  if (u.name?.trim()) return u.name.trim()
  return u.email.split('@')[0] ?? u.email
}

/** Two-letter initials for an avatar fallback. */
export function initials(u: Pick<User, 'first_name' | 'last_name' | 'name' | 'email'>): string {
  const f = u.first_name?.trim()[0]
  const l = u.last_name?.trim()[0]
  if (f || l) return `${f ?? ''}${l ?? ''}`.toUpperCase()
  const n = (u.name ?? u.email).trim()
  return n.slice(0, 2).toUpperCase()
}
