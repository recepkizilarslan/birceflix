import { env } from '../env.js'

const BASE = 'https://www.omdbapi.com/'

/**
 * In-process TTL cache keyed by imdb_id. OMDb's free tier is 1000 req/day
 * and movie detail pages fire one OMDb call per render — without this, a
 * user repeatedly opening the same movie burns budget for stale data that
 * barely changes between days (IMDb rating drifts slowly; Awards updates
 * during awards season). 12-hour TTL is well past any user revisit cadence
 * while still picking up the IMDb update within half a day.
 */
const TTL_MS = 12 * 60 * 60 * 1000

/** Hard cap on cache size so a long-running process can't unboundedly leak.
 * We see ~1k unique movies/year in real use; 10k entries is generous. The
 * eviction policy is "drop the oldest"  good enough for a TTL cache. */
const MAX_ENTRIES = 10_000

interface Entry {
  data: Record<string, unknown> | null
  expiresAt: number
}

const cache = new Map<string, Entry>()

function evictExpired(now: number) {
  // Map iterates in insertion order, so the head is the oldest. When we hit
  // capacity, walking from the start and stopping at the first non-expired
  // entry keeps eviction O(expired) rather than O(N).
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k)
    else break
  }
}

export async function omdbByImdbId(imdbId: string): Promise<Record<string, unknown> | null> {
  const now = Date.now()
  const cached = cache.get(imdbId)
  if (cached && cached.expiresAt > now) {
    return cached.data
  }
  // Cache miss (or expired) — fetch fresh.
  const u = new URL(BASE)
  u.searchParams.set('apikey', env.OMDB_API_KEY)
  u.searchParams.set('i', imdbId)
  const res = await fetch(u)
  let data: Record<string, unknown> | null = null
  if (res.ok) {
    const parsed = (await res.json()) as Record<string, unknown>
    if (parsed.Response !== 'False') data = parsed
  }

  // Cache negatives too, with a shorter TTL — a TMDB id with no OMDb match
  // (e.g. obscure title) shouldn't burn a request every render. Half the
  // positive TTL keeps things fresh enough if OMDb adds it later.
  const expiresAt = now + (data ? TTL_MS : TTL_MS / 2)

  // Refresh insertion order so re-reads stay "young" for eviction purposes.
  cache.delete(imdbId)
  cache.set(imdbId, { data, expiresAt })

  if (cache.size > MAX_ENTRIES) evictExpired(now)
  // If eviction didn't free anything (everything still fresh), bite off the
  // oldest entry regardless. Capacity is a hard ceiling, not a soft hint.
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }

  return data
}
