export interface User {
  id: string
  email: string
  name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

export interface PatchProfileInput {
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export async function getMe(): Promise<User | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`auth/me -> ${res.status}`)
  return res.json() as Promise<User>
}

export async function patchMe(input: PatchProfileInput): Promise<User> {
  return json(await fetch('/api/auth/me', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))
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
