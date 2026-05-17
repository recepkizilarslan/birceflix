export interface Env {
  TMDB_API_KEY: string
  OMDB_API_KEY: string
}

export const TMDB_BASE = 'https://api.themoviedb.org/3'
export const OMDB_BASE = 'https://www.omdbapi.com'

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      ...(init.headers ?? {}),
    },
  })
}

export function err(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export async function tmdb(env: Env, path: string, params: Record<string, string | number | undefined> = {}) {
  if (!env.TMDB_API_KEY) throw new Error('TMDB_API_KEY not configured')
  const url = new URL(TMDB_BASE + path)
  url.searchParams.set('api_key', env.TMDB_API_KEY)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`TMDB ${path} -> ${res.status}`)
  return res.json()
}

export async function omdb(env: Env, params: Record<string, string | undefined>) {
  if (!env.OMDB_API_KEY) throw new Error('OMDB_API_KEY not configured')
  const url = new URL(OMDB_BASE)
  url.searchParams.set('apikey', env.OMDB_API_KEY)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`OMDb -> ${res.status}`)
  return res.json()
}
