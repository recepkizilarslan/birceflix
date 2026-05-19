/**
 * Top-rated snapshot cache.
 *
 * Powers the "Top" filter on the Discover page. Per (mediaType, region) we
 * hold a snapshot of TMDB's top-rated list for that media type plus each
 * item's watch-provider list for that region. The Discover page consumes
 * this when its Top toggle is on so we can show provider banners without
 * an N+1 fetch over discover results.
 *
 * Source endpoints are first-class TMDB paginated lists:
 *   movie → /movie/top_rated
 *   tv    → /tv/top_rated
 *
 * Refresh is in-process: one warm pass on boot (awaited before
 * `app.listen` so the first request is hot) plus a daily setInterval. The
 * cache is volatile by design (single backend instance; restarts re-warm
 * in a few seconds). If we ever run multiple replicas, move this to
 * Postgres.
 *
 * Rate-limit safety: per-item provider fetches run with bounded concurrency
 * (CONCURRENCY) instead of an unbounded Promise.all over hundreds of ids.
 */
import { tmdb } from './tmdb.js'
import { env } from '../env.js'
import type { FastifyBaseLogger } from 'fastify'

/** How many provider fetches run in parallel. ~50 req/s is TMDB's pragmatic
 * cap; 20-wide chunks finish a 250-call burst in ~2-4s end-to-end. */
const CONCURRENCY = 20

/** Daily refresh cadence. */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

/** TMDB top-rated endpoints return 20 results per page. */
const PAGE_SIZE = 20

export type TopMediaType = 'movie' | 'tv'

interface TmdbTopRatedMovie {
  id: number
  title: string
  poster_path: string | null
  vote_average: number
  release_date?: string
  genre_ids?: number[]
}

interface TmdbTopRatedTv {
  id: number
  name: string
  poster_path: string | null
  vote_average: number
  first_air_date?: string
  genre_ids?: number[]
}

interface TmdbTopRatedResponse<T> {
  results: T[]
  page: number
  total_pages: number
  total_results: number
}

interface TmdbProviderEntry {
  provider_id: number
  provider_name: string
  logo_path: string
}

interface TmdbProvidersResponse {
  results?: Record<string, {
    flatrate?: TmdbProviderEntry[]
    rent?: TmdbProviderEntry[]
    buy?: TmdbProviderEntry[]
  }>
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
  /** TMDB genre ids (kept so the Discover client can filter top results by
   * genre without a per-item detail fetch). Empty when TMDB omits them. */
  genre_ids: number[]
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
  items: TopItem[]
}

interface CacheEntry {
  snapshot: TopSnapshot | null
  inflight: Promise<TopSnapshot> | null
  last_error: string | null
}

/** Cache key is `${mediaType}:${region}`. */
const cache = new Map<string, CacheEntry>()
let timer: NodeJS.Timeout | null = null

function cacheKey(mediaType: TopMediaType, region: string): string {
  return `${mediaType}:${region.toUpperCase()}`
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

async function fetchProviders(mediaType: TopMediaType, id: number, region: string): Promise<TopProvider[]> {
  try {
    const data = await tmdb<TmdbProvidersResponse>(`/${mediaType}/${id}/watch/providers`)
    const flatrate = data.results?.[region]?.flatrate ?? []
    return flatrate.map((p) => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path,
    }))
  } catch {
    // Single-item failure shouldn't poison the snapshot; surface as
    // "no provider data" and move on. The next daily refresh retries.
    return []
  }
}

async function buildSnapshot(
  mediaType: TopMediaType,
  region: string,
  log: FastifyBaseLogger | Console,
): Promise<TopSnapshot> {
  const started = Date.now()
  log.info({ mediaType, region }, '[top] refresh start')

  const pagesNeeded = Math.ceil(env.TOP_LIMIT / PAGE_SIZE)

  type Raw = TmdbTopRatedMovie | TmdbTopRatedTv
  const pages = await Promise.all(
    Array.from({ length: pagesNeeded }, (_, i) =>
      tmdb<TmdbTopRatedResponse<Raw>>(`/${mediaType}/top_rated`, {
        language: 'en-US',
        page: String(i + 1),
      }),
    ),
  )
  const raw = pages.flatMap((p) => p.results).slice(0, env.TOP_LIMIT)

  const providersByIndex = await mapLimit(raw, CONCURRENCY, (r) =>
    fetchProviders(mediaType, r.id, region),
  )

  const items: TopItem[] = raw.map((r, idx) => {
    const isTv = 'name' in r
    return {
      rank: idx + 1,
      id: r.id,
      title: isTv ? r.name : r.title,
      poster_path: r.poster_path,
      vote_average: r.vote_average,
      year: (isTv ? r.first_air_date : r.release_date)?.slice(0, 4) ?? null,
      genre_ids: r.genre_ids ?? [],
      providers: providersByIndex[idx] ?? [],
    }
  })

  const snapshot: TopSnapshot = {
    updated_at: new Date().toISOString(),
    media_type: mediaType,
    region,
    items,
  }

  log.info(
    { mediaType, region, count: items.length, duration_ms: Date.now() - started },
    '[top] refresh ok',
  )
  return snapshot
}

async function refreshEntry(
  mediaType: TopMediaType,
  region: string,
  log: FastifyBaseLogger | Console,
): Promise<TopSnapshot> {
  const key = cacheKey(mediaType, region)
  const entry = cache.get(key) ?? { snapshot: null, inflight: null, last_error: null }
  if (entry.inflight) return entry.inflight

  entry.inflight = buildSnapshot(mediaType, region, log)
    .then((snap) => {
      entry.snapshot = snap
      entry.last_error = null
      return snap
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      entry.last_error = msg
      log.error({ mediaType, region, err: msg }, '[top] refresh failed')
      throw err
    })
    .finally(() => {
      entry.inflight = null
    })

  cache.set(key, entry)
  return entry.inflight
}

/**
 * Returns the cached snapshot, kicking off a refresh on first access.
 * Concurrent callers share the same in-flight promise.
 */
export async function getTop(
  mediaType: TopMediaType,
  region: string,
  log: FastifyBaseLogger | Console,
): Promise<TopSnapshot> {
  const entry = cache.get(cacheKey(mediaType, region))
  if (entry?.snapshot) return entry.snapshot
  return refreshEntry(mediaType, region.toUpperCase(), log)
}

/**
 * Warm the default (movie + tv, default region) snapshots on boot. Awaited
 * before app.listen so the first request is hot. Other (mediaType, region)
 * combinations are filled lazily on demand. Daily refresh is scheduled
 * here too; the timer is guarded so reboots can't double-arm it.
 */
export async function startTopRefresh(log: FastifyBaseLogger): Promise<void> {
  const region = env.DEFAULT_WATCH_REGION.toUpperCase()
  await Promise.all([
    refreshEntry('movie', region, log).catch(() => undefined),
    refreshEntry('tv', region, log).catch(() => undefined),
  ])

  if (timer) return
  timer = setInterval(() => {
    // Refresh every (mediaType, region) pair we've ever served so warm
    // entries stay warm. Failures are logged and ignored — the next tick
    // (or an explicit request) will retry.
    for (const key of cache.keys()) {
      const [mt, r] = key.split(':') as [TopMediaType, string]
      refreshEntry(mt, r, log).catch(() => undefined)
    }
  }, REFRESH_INTERVAL_MS)
  timer.unref?.()
}

/** For debugging via /api/top/status. */
export function getTopStatus(): Array<{
  media_type: TopMediaType
  region: string
  updated_at: string | null
  item_count: number
  last_error: string | null
}> {
  return Array.from(cache.entries()).map(([key, entry]) => {
    const [mt, r] = key.split(':') as [TopMediaType, string]
    return {
      media_type: mt,
      region: r,
      updated_at: entry.snapshot?.updated_at ?? null,
      item_count: entry.snapshot?.items.length ?? 0,
      last_error: entry.last_error,
    }
  })
}
