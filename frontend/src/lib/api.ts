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

export interface TranslatedLanguage {
  iso_639_1: string
  english_name: string
  name: string
}

export interface MovieDetail extends TmdbMovie {
  imdb_id?: string
  runtime?: number
  genres?: { id: number; name: string }[]
  production_countries?: { iso_3166_1: string; name: string }[]
  spoken_languages?: { iso_639_1: string; english_name: string }[]
  translated_languages?: TranslatedLanguage[]
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
  /** TMDB person IDs. AND semantics — every listed person must appear in
   *  cast OR crew. Maps to /discover/movie?with_people=id1,id2,... */
  with_people?: number[]
  sort_by?: string
  page?: number
  /** Server-side filter: 'unwatched' subtracts watched IDs from a TMDB page;
   *  'watched' sources from the user's watched_movies directly (filters like
   *  genre/year are ignored in that mode — see response.filters_ignored). */
  watched_filter?: 'all' | 'unwatched' | 'watched'
}

export interface Person {
  id: number
  name: string
  profile_path: string | null
  known_for_department: string | null
  /** Comma-joined titles of the person's best-known credits, used as a
   *  subtitle in the picker. Empty when we rehydrate from /api/person/:id
   *  (TMDB's detail endpoint doesn't return known_for). */
  known_for: string
}

export interface PersonMovieCastCredit {
  id: number
  title: string
  poster_path: string | null
  release_date: string | null
  vote_average: number
  character: string | null
}

export interface PersonMovieCrewCredit {
  id: number
  title: string
  poster_path: string | null
  release_date: string | null
  vote_average: number
  job: string | null
  department: string | null
}

export interface PersonTvCastCredit {
  id: number
  name: string
  poster_path: string | null
  first_air_date: string | null
  vote_average: number
  character: string | null
  episode_count: number | null
}

export interface PersonTvCrewCredit {
  id: number
  name: string
  poster_path: string | null
  first_air_date: string | null
  vote_average: number
  job: string | null
  department: string | null
  episode_count: number | null
}

export interface PersonDetail extends Person {
  biography: string
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  also_known_as: string[]
  imdb_id: string | null
  homepage: string | null
  movie_cast: PersonMovieCastCredit[]
  movie_crew: PersonMovieCrewCredit[]
  tv_cast: PersonTvCastCredit[]
  tv_crew: PersonTvCrewCredit[]
}

export interface PersonSearchResponse {
  page: number
  total_pages: number
  total_results: number
  results: Person[]
}

export interface DiscoverResponse {
  results: TmdbMovie[]
  page: number
  total_pages: number
  total_results: number
  /** Present when watched_filter is non-'all'. Echoes back what the server applied. */
  watched_filter?: 'all' | 'unwatched' | 'watched'
  /** Number of items removed from this page by the server-side watched filter. */
  filtered_out?: number
  /** Filter knobs that the watched-mode path couldn't honor (no metadata in
   *  watched_movies). Frontend can dim these chips when present. */
  filters_ignored?: string[]
}

import { intlLocale } from '../i18n'

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

/**
 * Title to render in the UI. TMDB localizes title/name to ui_language, but
 * its Turkish translations for English originals tend to read poorly
 * ("Esaretin Bedeli" vs. "The Shawshank Redemption"); the product call here
 * is to keep en/tr originals in their own language and only fall back to
 * TMDB's localized title for content that originates in other languages
 * (Korean, Japanese, Hindi, ...), where the original script is unreadable
 * for most users.
 */
export function getContentTitle(item: {
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  original_language?: string
}): string {
  const title = item.title || item.name || ''
  const originalTitle = item.original_title || item.original_name || ''
  const originalLang = item.original_language || ''
  if ((originalLang === 'en' || originalLang === 'tr') && originalTitle) {
    return originalTitle
  }
  return title
}

export function discover(f: DiscoverFilters) {
  return get<DiscoverResponse>('/api/discover', {
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
    with_people: f.with_people?.length ? f.with_people.join(',') : undefined,
    sort_by: f.sort_by,
    page: f.page?.toString(),
    ui_language: intlLocale(),
    // Omit when 'all' to keep URLs tidy; backend default matches.
    watched_filter: f.watched_filter && f.watched_filter !== 'all' ? f.watched_filter : undefined,
  })
}

export function searchPerson(q: string, page = 1) {
  return get<PersonSearchResponse>('/api/person/search', {
    q,
    page: page.toString(),
    ui_language: intlLocale(),
  })
}

export function getPerson(id: number) {
  return get<PersonDetail>(`/api/person/${id}`, { ui_language: intlLocale() })
}

export function search(q: string, page = 1) {
  return get<{ results: TmdbMovie[]; page: number; total_pages: number }>('/api/search', {
    q,
    page: page.toString(),
    ui_language: intlLocale(),
  })
}

export function movieDetail(id: number, region = 'TR') {
  return get<MovieDetail>(`/api/movie/${id}`, { region, ui_language: intlLocale() })
}

export function listProviders(region = 'TR') {
  return get<ProviderListItem[]>('/api/providers', { region, ui_language: intlLocale() })
}

export function listGenres() {
  return get<Genre[]>('/api/genres', { ui_language: intlLocale() })
}

export interface TopProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

export interface TopItem {
  rank: number
  id: number
  title: string
  poster_path: string | null
  vote_average: number
  year: string | null
  genre_ids: number[]
  /** ISO 639-1 (lowercase). null when TMDB omits. */
  original_language: string | null
  /** ISO 3166-1 (uppercase). null when TMDB has no country listed. */
  origin_country: string | null
  /** Movies only. */
  runtime: number | null
  /** TV only. */
  number_of_seasons: number | null
  /** TV only. */
  number_of_episodes: number | null
  providers: TopProvider[]
}

export interface TopSnapshot {
  updated_at: string
  media_type: 'movie' | 'tv'
  region: string
  items: TopItem[]
}

export function top(mediaType: 'movie' | 'tv', region = 'TR') {
  return get<TopSnapshot>('/api/top', { media_type: mediaType, region, ui_language: intlLocale() })
}

// ---------------------------------------------------------------------------
// Quiz Tournament API
// ---------------------------------------------------------------------------

export type QuizMediaType = 'movie' | 'tv' | 'doc'

export interface QuizActiveSession {
  id: string
  current_round: number
  total_items: number
  remaining_count: number
}

export interface QuizCategory {
  id: string
  label_tr: string
  label_en: string
  media_type: QuizMediaType
  max_items: number
  active_session: QuizActiveSession | null
}

export interface QuizSession {
  id: string
  user_id: string
  category: string
  category_label: string
  total_items: number
  current_round: number
  remaining: number[]
  eliminated: number[]
  winner_id: number | null
  winner_title: string | null
  winner_poster_path: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface QuizStats {
  candidate_a: number
  candidate_b: number
  wins_a: number
  wins_b: number
  total: number
  pct_a: number
  pct_b: number
}

export interface QuizHistoryItem {
  id: string
  category: string
  category_label: string
  total_items: number
  winner_id: number | null
  winner_title: string | null
  winner_poster_path: string | null
  completed_at: string | null
  created_at: string
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(err.error ?? `${path} -> ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function listQuizCategories() {
  return get<QuizCategory[]>('/api/quiz/categories')
}

export function createQuizSession(
  category: string,
  opts: { region?: string; ui_language?: string; resume?: boolean } = {},
) {
  return post<QuizSession>('/api/quiz/sessions', {
    category,
    region: opts.region ?? 'TR',
    ui_language: opts.ui_language ?? intlLocale(),
    resume: opts.resume ?? false,
  })
}

export function getQuizSession(id: string) {
  return get<QuizSession>(`/api/quiz/sessions/${id}`)
}

export function voteQuiz(sessionId: string, winner: number, loser: number) {
  return post<QuizSession>(`/api/quiz/sessions/${sessionId}/vote`, { winner, loser })
}

export function getQuizResult(sessionId: string) {
  return get<QuizSession>(`/api/quiz/sessions/${sessionId}/result`)
}

export function getQuizStats(a: number, b: number, mediaType: QuizMediaType = 'movie') {
  return get<QuizStats>('/api/quiz/stats', {
    a: String(a),
    b: String(b),
    media_type: mediaType,
  })
}

export function getQuizHistory() {
  return get<QuizHistoryItem[]>('/api/quiz/history')
}
