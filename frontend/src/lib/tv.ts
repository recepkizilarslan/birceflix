export interface TmdbTvShow {
  id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  vote_count: number
  number_of_seasons?: number
  number_of_episodes?: number
}

export interface TvDetail extends TmdbTvShow {
  seasons?: TvSeasonSummary[]
  genres?: { id: number; name: string }[]
  credits?: { cast: { id: number; name: string; character: string; profile_path: string | null }[] }
  external_ids?: { imdb_id?: string | null }
  episode_run_time?: number[]
}

export interface TvSeasonSummary {
  id: number
  season_number: number
  name: string
  overview: string
  poster_path: string | null
  episode_count: number
  air_date: string | null
}

export interface TvSeasonDetail extends TvSeasonSummary {
  episodes: TvEpisode[]
}

export interface TvEpisode {
  id: number
  episode_number: number
  season_number: number
  name: string
  overview: string
  air_date: string | null
  runtime: number | null
  still_path: string | null
  vote_average: number
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export async function tvDetail(id: number): Promise<TvDetail> {
  return json(await fetch(`/api/tv/${id}`, { credentials: 'include' }))
}

export async function tvSeason(id: number, season: number): Promise<TvSeasonDetail> {
  return json(await fetch(`/api/tv/${id}/season/${season}`, { credentials: 'include' }))
}

export async function searchTv(q: string, page = 1): Promise<{ results: TmdbTvShow[]; page: number; total_pages: number }> {
  const u = new URL('/api/tv/search', window.location.origin)
  u.searchParams.set('q', q)
  u.searchParams.set('page', String(page))
  return json(await fetch(u.pathname + u.search, { credentials: 'include' }))
}

export async function popularTv(page = 1): Promise<{ results: TmdbTvShow[]; page: number; total_pages: number }> {
  const u = new URL('/api/tv/popular', window.location.origin)
  u.searchParams.set('page', String(page))
  return json(await fetch(u.pathname + u.search, { credentials: 'include' }))
}
