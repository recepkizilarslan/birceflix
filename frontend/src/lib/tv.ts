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

export interface DiscoverTvFilters {
  min_rating?: number
  original_language?: string
  origin_country?: string
  with_genres?: number[]
  year_from?: number
  year_to?: number
  with_watch_providers?: number[]
  watch_region?: string
  runtime_from?: number
  runtime_to?: number
  seasons_from?: number
  seasons_to?: number
  episodes_from?: number
  episodes_to?: number
  /** TMDB with_type (2 = Miniseries). Used by the "Mini dizi" category. */
  with_type?: number
  sort_by?: string
  page?: number
}

export function discoverTv(f: DiscoverTvFilters) {
  const u = new URL('/api/tv/discover', window.location.origin)
  const set = (k: string, v: string | undefined) => { if (v !== undefined && v !== '') u.searchParams.set(k, v) }
  set('min_rating', f.min_rating?.toString())
  set('original_language', f.original_language)
  set('origin_country', f.origin_country)
  set('with_genres', f.with_genres?.join(','))
  set('year_from', f.year_from?.toString())
  set('year_to', f.year_to?.toString())
  set('with_watch_providers', f.with_watch_providers?.join('|'))
  set('watch_region', f.watch_region)
  set('runtime_from', f.runtime_from?.toString())
  set('runtime_to', f.runtime_to?.toString())
  set('seasons_from', f.seasons_from?.toString())
  set('seasons_to', f.seasons_to?.toString())
  set('episodes_from', f.episodes_from?.toString())
  set('episodes_to', f.episodes_to?.toString())
  set('with_type', f.with_type?.toString())
  set('sort_by', f.sort_by)
  set('page', f.page?.toString())
  return fetch(u.pathname + u.search, { credentials: 'include' }).then(json) as Promise<{
    results: TmdbTvShow[]
    page: number
    total_pages: number
    filtered_out?: number
  }>
}

export async function listTvGenres(): Promise<{ id: number; name: string }[]> {
  return json(await fetch('/api/tv/genres', { credentials: 'include' }))
}

export async function listTvProviders(region: string): Promise<{
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}[]> {
  const u = new URL('/api/tv/providers', window.location.origin)
  u.searchParams.set('region', region)
  return json(await fetch(u.pathname + u.search, { credentials: 'include' }))
}
