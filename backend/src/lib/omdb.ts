import { env } from '../env.js'

const BASE = 'https://www.omdbapi.com/'

export async function omdbByImdbId(imdbId: string): Promise<Record<string, unknown> | null> {
  const u = new URL(BASE)
  u.searchParams.set('apikey', env.OMDB_API_KEY)
  u.searchParams.set('i', imdbId)
  const res = await fetch(u)
  if (!res.ok) return null
  const data = (await res.json()) as Record<string, unknown>
  if (data.Response === 'False') return null
  return data
}
