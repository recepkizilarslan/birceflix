import { DEFAULT_FILTERS, isTvMedia, type FilterState, type MediaType } from '../components/FilterPanel'
import { SORT_OPTIONS, TV_SORT_OPTIONS } from './constants'

/**
 * URL-encoded Discover state. The URL is the single source of truth for
 * the Discover page; this module is the only place we encode/decode it.
 *
 * Keys are short on purpose so shareable links stay tidy (think Trendyol /
 * Hepsiburada style):
 *
 *   type   movie | tv | doc        omitted when 'movie'
 *   q      search query            (free text)
 *   page   number 1..500           omitted when 1
 *   g      comma-sep genre IDs
 *   lang   ISO 639-1 code          original_language
 *   c      ISO 3166-1 code         origin_country
 *   r      number 0..10            min_rating
 *   yf|yt  number 1900..2100       year_from / year_to
 *   wp     comma-sep provider IDs  watch providers
 *   wr     ISO 3166-1 code         watch_region (only when wp non-empty)
 *   rtf|rtt number 0..600          runtime from/to (minutes)
 *   sf|st  number 0..100           seasons from/to (TV only)
 *   ef|et  number 0..5000          episodes from/to (TV only)
 *   sort   TMDB sort key           omitted when default
 *   top    "1"                      top-rated-only mode (movies + tv only)
 */

export interface DiscoverUrlState {
  mediaType: MediaType
  filters: FilterState
  query: string | null
  page: number
}

const KEY = {
  type: 'type',
  q: 'q',
  page: 'page',
  genres: 'g',
  lang: 'lang',
  country: 'c',
  rating: 'r',
  yearFrom: 'yf',
  yearTo: 'yt',
  providers: 'wp',
  region: 'wr',
  runtimeFrom: 'rtf',
  runtimeTo: 'rtt',
  seasonsFrom: 'sf',
  seasonsTo: 'st',
  episodesFrom: 'ef',
  episodesTo: 'et',
  sort: 'sort',
  top: 'top',
} as const

function parseMediaType(raw: string | null): MediaType {
  switch (raw) {
    case 'tv': return 'tv'
    case 'doc': return 'doc'
    default: return 'movie'
  }
}

function parseIntList(raw: string | null): number[] {
  if (!raw) return []
  const seen = new Set<number>()
  for (const part of raw.split(',')) {
    const n = Number.parseInt(part, 10)
    if (Number.isFinite(n) && n > 0) seen.add(n)
  }
  return [...seen]
}

function parseIntInRange(raw: string | null, lo: number, hi: number): number | '' {
  if (raw === null || raw === '') return ''
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return ''
  return Math.min(hi, Math.max(lo, n))
}

function parseFloatInRange(raw: string | null, lo: number, hi: number): number {
  if (raw === null || raw === '') return lo
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, n))
}

function parseSort(raw: string | null, mediaType: MediaType): string {
  if (!raw) return DEFAULT_FILTERS.sort_by
  const list = isTvMedia(mediaType) ? TV_SORT_OPTIONS : SORT_OPTIONS
  return list.some((o) => o.value === raw) ? raw : DEFAULT_FILTERS.sort_by
}

function parsePage(raw: string | null): number {
  const n = parseIntInRange(raw, 1, 500)
  return typeof n === 'number' ? n : 1
}

/**
 * Parse Discover state from URL search params. Invalid values fall back to
 * defaults so hand-edited or stale links still load instead of crashing.
 *
 * `defaultRegion` is the user's preferred watch region; used when the URL
 * omits `wr` so the FilterPanel's region selector starts on a sensible value.
 */
export function parseDiscoverUrl(sp: URLSearchParams, defaultRegion: string): DiscoverUrlState {
  const mediaType = parseMediaType(sp.get(KEY.type))
  const tv = isTvMedia(mediaType)

  const filters: FilterState = {
    min_rating: parseFloatInRange(sp.get(KEY.rating), 0, 10),
    original_language: sp.get(KEY.lang) ?? '',
    origin_country: sp.get(KEY.country) ?? '',
    with_genres: parseIntList(sp.get(KEY.genres)),
    year_from: parseIntInRange(sp.get(KEY.yearFrom), 1900, 2100),
    year_to: parseIntInRange(sp.get(KEY.yearTo), 1900, 2100),
    with_watch_providers: parseIntList(sp.get(KEY.providers)),
    watch_region: sp.get(KEY.region) || defaultRegion,
    runtime_from: parseIntInRange(sp.get(KEY.runtimeFrom), 0, 600),
    runtime_to: parseIntInRange(sp.get(KEY.runtimeTo), 0, 600),
    seasons_from: tv ? parseIntInRange(sp.get(KEY.seasonsFrom), 0, 100) : '',
    seasons_to: tv ? parseIntInRange(sp.get(KEY.seasonsTo), 0, 100) : '',
    episodes_from: tv ? parseIntInRange(sp.get(KEY.episodesFrom), 0, 5000) : '',
    episodes_to: tv ? parseIntInRange(sp.get(KEY.episodesTo), 0, 5000) : '',
    sort_by: parseSort(sp.get(KEY.sort), mediaType),
    // top-mode flag, ignored for doc since there's no /doc top_rated.
    top_only: sp.get(KEY.top) === '1' && mediaType !== 'doc',
  }

  const rawQuery = sp.get(KEY.q)
  const query = rawQuery && rawQuery.trim() ? rawQuery.trim() : null

  return { mediaType, filters, query, page: parsePage(sp.get(KEY.page)) }
}

/**
 * Serialize Discover state back to URL search params. Default values are
 * omitted to keep links short, and TV-only fields are dropped for movie
 * categories so a /discover?type=tv&sf=2 link doesn't leak `sf` after the
 * user flips back to movies.
 */
export function serializeDiscoverUrl(state: DiscoverUrlState): URLSearchParams {
  const sp = new URLSearchParams()
  const { mediaType, filters: f, query, page } = state
  const tv = isTvMedia(mediaType)

  if (mediaType !== 'movie') sp.set(KEY.type, mediaType)
  if (query) sp.set(KEY.q, query)
  if (page > 1) sp.set(KEY.page, String(page))

  if (f.min_rating > 0) sp.set(KEY.rating, String(f.min_rating))
  if (f.original_language) sp.set(KEY.lang, f.original_language)
  if (f.origin_country) sp.set(KEY.country, f.origin_country)
  if (f.with_genres.length) sp.set(KEY.genres, f.with_genres.join(','))
  if (typeof f.year_from === 'number') sp.set(KEY.yearFrom, String(f.year_from))
  if (typeof f.year_to === 'number') sp.set(KEY.yearTo, String(f.year_to))

  if (f.with_watch_providers.length) {
    sp.set(KEY.providers, f.with_watch_providers.join(','))
    // Region is meaningless without providers, but when they're picked we
    // always include the region so a recipient in another country still
    // sees the same provider list the sharer curated.
    if (f.watch_region) sp.set(KEY.region, f.watch_region)
  }

  if (typeof f.runtime_from === 'number') sp.set(KEY.runtimeFrom, String(f.runtime_from))
  if (typeof f.runtime_to === 'number') sp.set(KEY.runtimeTo, String(f.runtime_to))

  if (tv) {
    if (typeof f.seasons_from === 'number') sp.set(KEY.seasonsFrom, String(f.seasons_from))
    if (typeof f.seasons_to === 'number') sp.set(KEY.seasonsTo, String(f.seasons_to))
    if (typeof f.episodes_from === 'number') sp.set(KEY.episodesFrom, String(f.episodes_from))
    if (typeof f.episodes_to === 'number') sp.set(KEY.episodesTo, String(f.episodes_to))
  }

  if (f.sort_by && f.sort_by !== DEFAULT_FILTERS.sort_by) sp.set(KEY.sort, f.sort_by)

  // top-only flag never applies to /doc (no top_rated endpoint), so drop
  // it from the URL even if a stale state would have set it.
  if (f.top_only && mediaType !== 'doc') sp.set(KEY.top, '1')

  return sp
}
