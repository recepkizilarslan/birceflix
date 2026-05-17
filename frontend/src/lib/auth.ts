export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
}

export async function getMe(): Promise<User | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`auth/me -> ${res.status}`)
  return res.json() as Promise<User>
}
