import type { TmdbMovie } from './api'

export interface CalendarResponse {
  results: TmdbMovie[]
  page: number
  total_pages: number
  total_results: number
  dates?: { minimum: string; maximum: string }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export async function getUpcoming(page = 1, region?: string): Promise<CalendarResponse> {
  const u = new URL('/api/calendar/upcoming', window.location.origin)
  u.searchParams.set('page', String(page))
  if (region) u.searchParams.set('region', region)
  return json(await fetch(u.pathname + u.search, { credentials: 'include' }))
}

export async function getNowPlaying(page = 1, region?: string): Promise<CalendarResponse> {
  const u = new URL('/api/calendar/now-playing', window.location.origin)
  u.searchParams.set('page', String(page))
  if (region) u.searchParams.set('region', region)
  return json(await fetch(u.pathname + u.search, { credentials: 'include' }))
}
