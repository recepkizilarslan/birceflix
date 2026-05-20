/**
 * Top-rated snapshot cache.
 *
 * Powers the "Top" filter on the Discover page. Per (mediaType, region) we
 * hold a snapshot of TMDB's top-rated list for that media type plus the
 * rich detail (runtime, language, country, genres, providers, ...) for each
 * item in that region. The Discover page consumes this when its Top toggle
 * is on so every filter (rating / year / genre / language / country /
 * runtime / seasons / providers) can apply client-side over the same 250
 * items, without per-keystroke TMDB traffic.
 *
 * Two-phase refresh:
 *   1. paginate /{mediaType}/top_rated to get 250 ordered ids
 *   2. per item, fetch /{mediaType}/{id}?append_to_response=watch/providers
 *      so we get runtime / language / country / seasons / providers in one
 *      shot
 *
 * Refresh is in-process: one warm pass on boot (awaited before
 * `app.listen` so the first request is hot) plus a daily setInterval. The
 * cache is volatile by design (single backend instance; restarts re-warm
 * in a few seconds). If we ever run multiple replicas, move this to
 * Postgres.
 *
 * Rate-limit safety: per-item detail fetches run with bounded concurrency
 * (CONCURRENCY) instead of an unbounded Promise.all over hundreds of ids.
 */
import { tmdb } from './tmdb.js'
import { env } from '../env.js'
import type { FastifyBaseLogger } from 'fastify'

/** How many detail fetches run in parallel. TMDB's pragmatic cap is ~50
 * req/s; 20-wide chunks finish a 250-call burst in a few seconds. */
const CONCURRENCY = 20

/** Daily refresh cadence. */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

/** TMDB top-rated endpoints return 20 results per page. */
const PAGE_SIZE = 20

export type TopMediaType = 'movie' | 'tv'

interface TmdbTopRatedListItem {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
}

interface TmdbTopRatedResponse {
  results: TmdbTopRatedListItem[]
  page: number
  total_pages: number
  total_results: number
}

interface TmdbProviderEntry {
  provider_id: number
  provider_name: string
  logo_path: string
}

interface TmdbWatchProvidersBag {
  results?: Record<string, {
    flatrate?: TmdbProviderEntry[]
    rent?: TmdbProviderEntry[]
    buy?: TmdbProviderEntry[]
  }>
}

/** Subset of /movie/{id} (and /tv/{id}) detail we read. Each TMDB endpoint
 * returns a much wider object; we only type the fields we use so a TMDB
 * shape tweak elsewhere doesn't force a recompile. */
interface TmdbDetail {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
  original_language?: string
  runtime?: number | null
  number_of_seasons?: number | null
  number_of_episodes?: number | null
  genres?: { id: number; name: string }[]
  /** Movies — array of `{iso_3166_1, name}`. */
  production_countries?: { iso_3166_1: string; name: string }[]
  /** TV — array of ISO country codes. */
  origin_country?: string[]
  'watch/providers'?: TmdbWatchProvidersBag
}

export interface TopProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

export interface TopItem {
  rank: number
  id: number
  /** Normalised title (TMDB calls it `title` for movies, `name` for TV). */
  title: string
  poster_path: string | null
  vote_average: number
  year: string | null
  genre_ids: number[]
  /** ISO 639-1 code, lowercase (e.g. 'hi', 'ja'). null when TMDB omits it. */
  original_language: string | null
  /** ISO 3166-1 code, uppercase. For movies, the first production country;
   * for TV, the first origin country. null when TMDB lists none. */
  origin_country: string | null
  /** Runtime in minutes — movies only. null for TV (use season/episode
   * counts there instead). */
  runtime: number | null
  /** TV only; null for movies. */
  number_of_seasons: number | null
  /** TV only; null for movies. */
  number_of_episodes: number | null
  /** Flatrate (subscription) providers in the requested region. Empty
   * array means "no flatrate data" — could be unavailable in that region
   * or only rentable. */
  providers: TopProvider[]
}

export interface TopSnapshot {
  /** ISO timestamp of the last successful refresh. */
  updated_at: string
  media_type: TopMediaType
  region: string
  language: string
  items: TopItem[]
}

interface CacheEntry {
  snapshot: TopSnapshot | null
  inflight: Promise<TopSnapshot> | null
  last_error: string | null
}

/** Cache key is `${mediaType}:${region}:${language}`. Language is part of
 * the key because titles localize per UI language (e.g. "Esaretin Bedeli"
 * vs. "The Shawshank Redemption"); the rest of the snapshot is identical. */
const cache = new Map<string, CacheEntry>()
let timer: NodeJS.Timeout | null = null

function cacheKey(mediaType: TopMediaType, region: string, language: string): string {
  return `${mediaType}:${region.toUpperCase()}:${language}`
}

/** Run `fn` against each item with at most `limit` concurrent invocations. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: (R | undefined)[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= items.length) return
      const item = items[idx]
      if (item === undefined) continue
      out[idx] = await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out as R[]
}

/** Single detail fetch with watch-providers appended. Returns null on any
 * failure so one bad id can't poison the whole snapshot; the next daily
 * refresh retries. */
async function fetchDetail(mediaType: TopMediaType, id: number, language: string): Promise<TmdbDetail | null> {
  try {
    return await tmdb<TmdbDetail>(`/${mediaType}/${id}`, {
      language,
      append_to_response: 'watch/providers',
    })
  } catch {
    return null
  }
}

function extractProviders(detail: TmdbDetail, region: string): TopProvider[] {
  const bag = detail['watch/providers']?.results?.[region]
  const flatrate = bag?.flatrate ?? []
  return flatrate.map((p) => ({
    provider_id: p.provider_id,
    provider_name: p.provider_name,
    logo_path: p.logo_path,
  }))
}

function extractOriginCountry(mediaType: TopMediaType, detail: TmdbDetail): string | null {
  if (mediaType === 'tv') {
    return detail.origin_country?.[0]?.toUpperCase() ?? null
  }
  return detail.production_countries?.[0]?.iso_3166_1?.toUpperCase() ?? null
}

async function buildSnapshot(
  mediaType: TopMediaType,
  region: string,
  language: string,
  log: FastifyBaseLogger | Console,
): Promise<TopSnapshot> {
  const started = Date.now()
  log.info({ mediaType, region, language }, '[top] refresh start')

  // Phase 1: ordered list of ids. Cheap, paginated. We pull pages in
  // parallel since they're independent.
  const pagesNeeded = Math.ceil(env.TOP_LIMIT / PAGE_SIZE)
  const pages = await Promise.all(
    Array.from({ length: pagesNeeded }, (_, i) =>
      tmdb<TmdbTopRatedResponse>(`/${mediaType}/top_rated`, {
        language,
        page: String(i + 1),
      }),
    ),
  )
  const listItems = pages.flatMap((p) => p.results).slice(0, env.TOP_LIMIT)

  // Phase 2: per-id detail with providers appended. One call per item
  // gives us everything Discover's filters need (runtime, language,
  // country, genres, seasons/episodes, providers).
  const detailsByIndex = await mapLimit(listItems, CONCURRENCY, (l) =>
    fetchDetail(mediaType, l.id, language),
  )

  const items: TopItem[] = listItems.map((l, idx) => {
    const detail = detailsByIndex[idx]
    const isTv = mediaType === 'tv'
    return {
      rank: idx + 1,
      id: l.id,
      // List response carries title/name reliably; detail is a fallback in
      // case TMDB ever ships a list row without one.
      title: (isTv ? l.name : l.title) ?? detail?.title ?? detail?.name ?? '',
      poster_path: l.poster_path,
      vote_average: l.vote_average,
      year: (isTv ? l.first_air_date : l.release_date)?.slice(0, 4) ?? null,
      genre_ids: detail?.genres?.map((g) => g.id) ?? [],
      original_language: detail?.original_language?.toLowerCase() ?? null,
      origin_country: detail ? extractOriginCountry(mediaType, detail) : null,
      runtime: !isTv ? (detail?.runtime ?? null) : null,
      number_of_seasons: isTv ? (detail?.number_of_seasons ?? null) : null,
      number_of_episodes: isTv ? (detail?.number_of_episodes ?? null) : null,
      providers: detail ? extractProviders(detail, region) : [],
    }
  })

  const snapshot: TopSnapshot = {
    updated_at: new Date().toISOString(),
    media_type: mediaType,
    region,
    language,
    items,
  }

  log.info(
    { mediaType, region, language, count: items.length, duration_ms: Date.now() - started },
    '[top] refresh ok',
  )
  return snapshot
}

async function refreshEntry(
  mediaType: TopMediaType,
  region: string,
  language: string,
  log: FastifyBaseLogger | Console,
): Promise<TopSnapshot> {
  const key = cacheKey(mediaType, region, language)
  const entry = cache.get(key) ?? { snapshot: null, inflight: null, last_error: null }
  if (entry.inflight) return entry.inflight

  entry.inflight = buildSnapshot(mediaType, region, language, log)
    .then((snap) => {
      entry.snapshot = snap
      entry.last_error = null
      return snap
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      entry.last_error = msg
      log.error({ mediaType, region, language, err: msg }, '[top] refresh failed')
      throw err
    })
    .finally(() => {
      entry.inflight = null
    })

  cache.set(key, entry)
  return entry.inflight
}

/** Languages warmed at boot. Matches the frontend's supportedLngs in
 * src/i18n/index.ts — keep them in sync if a new locale is added. */
const WARM_LANGUAGES = ['tr-TR', 'en-US']

/**
 * Returns the cached snapshot, kicking off a refresh on first access.
 * Concurrent callers share the same in-flight promise.
 */
export async function getTop(
  mediaType: TopMediaType,
  region: string,
  language: string,
  log: FastifyBaseLogger | Console,
): Promise<TopSnapshot> {
  const entry = cache.get(cacheKey(mediaType, region, language))
  if (entry?.snapshot) return entry.snapshot
  return refreshEntry(mediaType, region.toUpperCase(), language, log)
}

/**
 * Warm the default (movie + tv, default region, each warm language)
 * snapshots on boot. Awaited before app.listen so the first request is
 * hot. Other (mediaType, region, language) combinations are filled lazily
 * on demand. Daily refresh is scheduled here too; the timer is guarded so
 * reboots can't double-arm it.
 */
export async function startTopRefresh(log: FastifyBaseLogger): Promise<void> {
  const region = env.DEFAULT_WATCH_REGION.toUpperCase()
  await Promise.all(
    WARM_LANGUAGES.flatMap((lang) => [
      refreshEntry('movie', region, lang, log).catch(() => undefined),
      refreshEntry('tv', region, lang, log).catch(() => undefined),
    ]),
  )

  if (timer) return
  timer = setInterval(() => {
    // Refresh every (mediaType, region, language) triple we've ever served
    // so warm entries stay warm. Failures are logged and ignored — the
    // next tick (or an explicit request) will retry.
    for (const key of cache.keys()) {
      const [mt, r, lang] = key.split(':') as [TopMediaType, string, string]
      refreshEntry(mt, r, lang, log).catch(() => undefined)
    }
  }, REFRESH_INTERVAL_MS)
  timer.unref?.()
}

/** For debugging via /api/top/status. */
export function getTopStatus(): Array<{
  media_type: TopMediaType
  region: string
  language: string
  updated_at: string | null
  item_count: number
  last_error: string | null
}> {
  return Array.from(cache.entries()).map(([key, entry]) => {
    const [mt, r, lang] = key.split(':') as [TopMediaType, string, string]
    return {
      media_type: mt,
      region: r,
      language: lang,
      updated_at: entry.snapshot?.updated_at ?? null,
      item_count: entry.snapshot?.items.length ?? 0,
      last_error: entry.last_error,
    }
  })
}
