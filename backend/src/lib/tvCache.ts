/**
 * Lightweight cache for the per-show counts (number_of_seasons +
 * number_of_episodes). TMDB's discover/search responses don't carry
 * these — only the /tv/:id detail does — so the discover route would
 * have to do one extra call per result. Cache so paginating back and
 * forth doesn't refetch the same shows.
 */
import { tmdb } from './tmdb.js'

export interface TvBrief {
  number_of_seasons: number | null
  number_of_episodes: number | null
}

interface CacheEntry {
  data: TvBrief
  expires: number
}

const TTL_MS = 60 * 60 * 1000 // 1 hour
const cache = new Map<number, CacheEntry>()

const MAX_CACHE_SIZE = 1000

/** Periodic cleanup so the Map doesn't grow without bound. */
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of cache.entries()) {
    if (v.expires <= now) cache.delete(k)
  }
  
  if (cache.size > MAX_CACHE_SIZE) {
    const keys = Array.from(cache.keys())
    const toRemove = keys.slice(0, cache.size - MAX_CACHE_SIZE)
    for (const k of toRemove) {
      cache.delete(k)
    }
  }
}, 10 * 60 * 1000).unref?.()

export async function getTvBrief(id: number): Promise<TvBrief | null> {
  const now = Date.now()
  const cached = cache.get(id)
  if (cached && cached.expires > now) return cached.data

  try {
    const data = await tmdb<{
      number_of_seasons?: number
      number_of_episodes?: number
    }>(`/tv/${id}`, { language: 'en-US' })
    const brief: TvBrief = {
      number_of_seasons: data.number_of_seasons ?? null,
      number_of_episodes: data.number_of_episodes ?? null,
    }
    cache.set(id, { data: brief, expires: now + TTL_MS })
    return brief
  } catch {
    return null
  }
}

/**
 * Decorate each list row with its brief counts. Fetches are parallel
 * (TMDB allows ~40 req/sec; a 20-row page sits well inside that).
 * Failures fall back to nulls — the UI just hides the chip.
 */
export async function enrichTvBrief<T extends { id: number }>(rows: T[]): Promise<(T & TvBrief)[]> {
  const briefs = await Promise.all(rows.map((r) => getTvBrief(r.id)))
  return rows.map((r, i) => ({
    ...r,
    number_of_seasons: briefs[i]?.number_of_seasons ?? null,
    number_of_episodes: briefs[i]?.number_of_episodes ?? null,
  }))
}
