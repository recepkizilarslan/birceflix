export interface TmdbMovie {
  id: number
  title: string
  original_title: string
  original_language: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids?: number[]
}

export interface MovieDetail extends TmdbMovie {
  imdb_id?: string
  runtime?: number
  genres?: { id: number; name: string }[]
  production_countries?: { iso_3166_1: string; name: string }[]
  spoken_languages?: { iso_639_1: string; english_name: string }[]
  reviews?: { results: TmdbReview[] }
  credits?: { cast: { id: number; name: string; character: string; profile_path: string | null }[] }
  videos?: { results: { key: string; site: string; type: string }[] }
  awards?: string | null
  imdb_rating?: string | null
  watch_providers?: WatchProviderRegion | null
  omdb?: Record<string, unknown> | null
}

export interface TmdbReview {
  id: string
  author: string
  author_details?: { rating: number | null; avatar_path: string | null }
  content: string
  created_at: string
  url: string
}

export interface WatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

export interface WatchProviderRegion {
  link?: string
  flatrate?: WatchProvider[]
  rent?: WatchProvider[]
  buy?: WatchProvider[]
}

export interface ProviderListItem extends WatchProvider {
  display_priority: number
}

export interface Genre {
  id: number
  name: string
}

export interface DiscoverFilters {
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
  sort_by?: string
  page?: number
}

const TMDB_IMG = 'https://image.tmdb.org/t/p'

export function poster(path: string | null | undefined, size: 'w185' | 'w342' | 'w500' | 'original' = 'w342') {
  if (!path) return null
  return `${TMDB_IMG}/${size}${path}`
}

export function logo(path: string | null | undefined, size: 'w45' | 'w92' | 'original' = 'w92') {
  if (!path) return null
  return `${TMDB_IMG}/${size}${path}`
}

async function get<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const u = new URL(path, window.location.origin)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, v)
  const res = await fetch(u.pathname + u.search)
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json() as Promise<T>
}

export function discover(f: DiscoverFilters) {
  return get<{ results: TmdbMovie[]; page: number; total_pages: number; total_results: number }>('/api/discover', {
    min_rating: f.min_rating?.toString(),
    original_language: f.original_language,
    origin_country: f.origin_country,
    with_genres: f.with_genres?.join(','),
    year_from: f.year_from?.toString(),
    year_to: f.year_to?.toString(),
    with_watch_providers: f.with_watch_providers?.join('|'),
    watch_region: f.watch_region,
    runtime_from: f.runtime_from?.toString(),
    runtime_to: f.runtime_to?.toString(),
    sort_by: f.sort_by,
    page: f.page?.toString(),
  })
}

export function search(q: string, page = 1) {
  return get<{ results: TmdbMovie[]; page: number; total_pages: number }>('/api/search', { q, page: page.toString() })
}

export function movieDetail(id: number, region = 'TR') {
  return get<MovieDetail>(`/api/movie/${id}`, { region })
}

export function listProviders(region = 'TR') {
  return get<ProviderListItem[]>('/api/providers', { region })
}

export function listGenres() {
  return get<Genre[]>('/api/genres')
}

export interface ImdbTopProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

export interface ImdbTopMovie {
  rank: number
  id: number
  title: string
  poster_path: string | null
  vote_average: number
  year: string | null
  providers: ImdbTopProvider[]
}

export interface ImdbTopSnapshot {
  updated_at: string
  source: { list_id: number; list_name: string }
  movies: ImdbTopMovie[]
}

export function imdbTop(region = 'TR') {
  return get<ImdbTopSnapshot>('/api/imdb-top', { region })
}
