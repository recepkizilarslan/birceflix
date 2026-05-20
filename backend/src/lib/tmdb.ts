import { env } from '../env.js'

const BASE = 'https://api.themoviedb.org/3'

export async function tmdb<T = unknown>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const u = new URL(BASE + path)
  // TMDB exposes two auth schemes that share TMDB_API_KEY: the legacy v3
  // api_key query param and the v4 read-access-token Bearer header. v4
  // tokens are JWTs that start with "eyJ"; sniffing the prefix lets the
  // same env var work for either without a separate config flag.
  const headers: Record<string, string> = { accept: 'application/json' }
  if (env.TMDB_API_KEY.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${env.TMDB_API_KEY}`
  } else {
    u.searchParams.set('api_key', env.TMDB_API_KEY)
  }
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.searchParams.set(k, v)
  }
  const res = await fetch(u, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`tmdb ${path} -> ${res.status} ${body.slice(0, 200)}`)
  }
  return (await res.json()) as T
}
