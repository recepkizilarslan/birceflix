import { env } from '../env.js'

const BASE = 'https://api.themoviedb.org/3'

export async function tmdb<T = unknown>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const u = new URL(BASE + path)
  u.searchParams.set('api_key', env.TMDB_API_KEY)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.searchParams.set(k, v)
  }
  const res = await fetch(u, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`tmdb ${path} -> ${res.status} ${body.slice(0, 200)}`)
  }
  return (await res.json()) as T
}
