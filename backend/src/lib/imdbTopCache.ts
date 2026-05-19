/**
 * IMDb Top snapshot cache.
 *
 * One source list (TMDB public list mirroring IMDb's top movies) plus a
 * per-region snapshot of watch providers for every movie in that list. The
 * list endpoint already carries the movie metadata we need on the card
 * (title, poster, year, rating), so the only per-item TMDB call we make
 * is `/movie/{id}/watch/providers?watch_region=XX`.
 *
 * Refresh is in-process: one warm pass on boot (awaited before `app.listen`
 * to keep first response hot) plus a daily `setInterval`. The cache is
 * volatile by design — single backend instance, restarts re-warm in a few
 * seconds. If we ever run multiple replicas or want survive-restart
 * persistence we should move this to Postgres (precedent: drizzle
 * migrations container in docker-compose), but the workload doesn't need it
 * yet.
 *
 * TMDB rate-limit safety: fetches run with bounded concurrency
 * (CONCURRENCY) instead of an unbounded `Promise.all` over 200 ids — the
 * burst would otherwise risk 429s.
 */
import { tmdb } from './tmdb.js'
import { env } from '../env.js'
import type { FastifyBaseLogger } from 'fastify'

/** How many provider fetches run in parallel. ~50 req/s is TMDB's pragmatic
 * cap; 20-wide chunks land comfortably below that and finish the 200-call
 * burst in ~2-4s end-to-end. */
const CONCURRENCY = 20

/** Daily refresh cadence. */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

interface TmdbListItem {
  id: number
  media_type?: string
  title?: string
  name?: string
  poster_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
}

interface TmdbListResponse {
  items: TmdbListItem[]
  item_count: number
  name: string
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
  /** Subscription/flatrate providers in the requested region (e.g. Netflix,
   * Prime Video). Empty array means TMDB has no flatrate data — could be
   * "not available" OR "only rent/buy". UI shows a neutral placeholder. */
  providers: ImdbTopProvider[]
}

export interface ImdbTopSnapshot {
  /** ISO timestamp of the last successful refresh — surfaced in the API
   * response so the UI can show a freshness badge. */
  updated_at: string
  /** Source list metadata for attribution. */
  source: { list_id: number; list_name: string }
  movies: ImdbTopMovie[]
}

interface PerRegionCache {
  /** Last *successful* snapshot. Served even while a refresh is mid-flight
   * so users never see a half-baked list. */
  snapshot: ImdbTopSnapshot | null
  /** In-flight refresh, if any — concurrent callers await the same promise
   * instead of stampeding TMDB. */
  inflight: Promise<ImdbTopSnapshot> | null
  /** Last refresh error message, for /api/health-style debugging. */
  last_error: string | null
}

const byRegion = new Map<string, PerRegionCache>()
let timer: NodeJS.Timeout | null = null

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

async function fetchProviders(movieId: number, region: string): Promise<ImdbTopProvider[]> {
  try {
    const data = await tmdb<TmdbProvidersResponse>(`/movie/${movieId}/watch/providers`)
    const flatrate = data.results?.[region]?.flatrate ?? []
    return flatrate.map((p) => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path,
    }))
  } catch {
    // Single-movie failure shouldn't poison the whole snapshot; surface as
    // "no provider data" and move on. The next daily refresh retries.
    return []
  }
}

async function buildSnapshot(region: string, log: FastifyBaseLogger | Console): Promise<ImdbTopSnapshot> {
  const started = Date.now()
  log.info({ region }, '[imdb-top] refresh start')

  const list = await tmdb<TmdbListResponse>(`/list/${env.IMDB_TOP_LIST_ID}`, {
    language: 'en-US',
  })

  const movies = list.items
    .filter((it) => it.media_type !== 'tv') // lists can mix; we only want movies
    .slice(0, env.IMDB_TOP_LIMIT)

  const providersByIndex = await mapLimit(movies, CONCURRENCY, (m) => fetchProviders(m.id, region))

  const snapshot: ImdbTopSnapshot = {
    updated_at: new Date().toISOString(),
    source: { list_id: env.IMDB_TOP_LIST_ID, list_name: list.name },
    movies: movies.map((m, idx) => ({
      rank: idx + 1,
      id: m.id,
      title: m.title ?? m.name ?? '',
      poster_path: m.poster_path,
      vote_average: m.vote_average,
      year: (m.release_date ?? m.first_air_date ?? null)?.slice(0, 4) || null,
      providers: providersByIndex[idx] ?? [],
    })),
  }

  log.info(
    { region, count: snapshot.movies.length, duration_ms: Date.now() - started },
    '[imdb-top] refresh ok',
  )
  return snapshot
}

async function refreshRegion(region: string, log: FastifyBaseLogger | Console): Promise<ImdbTopSnapshot> {
  const entry = byRegion.get(region) ?? { snapshot: null, inflight: null, last_error: null }
  if (entry.inflight) return entry.inflight

  entry.inflight = buildSnapshot(region, log)
    .then((snap) => {
      entry.snapshot = snap
      entry.last_error = null
      return snap
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      entry.last_error = msg
      log.error({ region, err: msg }, '[imdb-top] refresh failed')
      throw err
    })
    .finally(() => {
      entry.inflight = null
    })

  byRegion.set(region, entry)
  return entry.inflight
}

/**
 * Returns the cached snapshot for `region`, kicking off a refresh on first
 * access. Subsequent calls within the day return cached data. If a refresh
 * is in flight, concurrent callers share its promise.
 */
export async function getImdbTop(region: string, log: FastifyBaseLogger | Console): Promise<ImdbTopSnapshot> {
  const entry = byRegion.get(region)
  if (entry?.snapshot) return entry.snapshot
  return refreshRegion(region, log)
}

/**
 * Warm the default region on boot. Awaited before `app.listen()` so the
 * first /api/imdb-top response is hot. Other regions are filled lazily on
 * demand. Daily refresh is also scheduled here so subsequent restarts
 * don't accidentally double-arm the timer.
 */
export async function startImdbTopRefresh(log: FastifyBaseLogger): Promise<void> {
  await refreshRegion(env.DEFAULT_WATCH_REGION, log).catch(() => {
    // Boot must not fail because TMDB's flaky; the cache will retry on next
    // request and on the daily tick. The error is already logged above.
  })

  if (timer) return
  timer = setInterval(() => {
    // Refresh every region we've ever served, not just the default — once
    // a user pulls /api/imdb-top?region=US we want it kept warm too.
    for (const region of byRegion.keys()) {
      refreshRegion(region, log).catch(() => undefined)
    }
  }, REFRESH_INTERVAL_MS)
  timer.unref?.()
}

/** For debugging / health endpoints. */
export function getImdbTopStatus(): Array<{
  region: string
  updated_at: string | null
  movie_count: number
  last_error: string | null
}> {
  return Array.from(byRegion.entries()).map(([region, entry]) => ({
    region,
    updated_at: entry.snapshot?.updated_at ?? null,
    movie_count: entry.snapshot?.movies.length ?? 0,
    last_error: entry.last_error,
  }))
}
