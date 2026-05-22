import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { uiLanguageSchema } from '../lib/locale.js'
import { env } from '../env.js'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
  ui_language: uiLanguageSchema,
})

/**
 * TMDB's /upcoming and /now_playing return a `dates: { minimum, maximum }`
 * window meant to describe the result set, but the actual results often
 * include titles whose release_date falls outside that window (TMDB indexes
 * regional release variants that don't always match). The frontend Calendar
 * groups by release_date and shows everything; out-of-window groups render
 * as orphan rows that the "dates" hint says shouldn't exist.
 *
 * Clip server-side so the response is internally consistent.
 */
function clipToDateWindow<T extends { release_date?: string | null }>(
  results: T[],
  dates: { minimum?: string; maximum?: string } | undefined,
): T[] {
  if (!dates?.minimum && !dates?.maximum) return results
  const min = dates.minimum
  const max = dates.maximum
  return results.filter((r) => {
    const d = r.release_date
    if (!d) return true // keep items with missing dates rather than dropping silently
    if (min && d < min) return false
    if (max && d > max) return false
    return true
  })
}

interface UpcomingResponse {
  page: number
  total_pages: number
  total_results: number
  results: { release_date?: string | null; [k: string]: unknown }[]
  dates?: { minimum?: string; maximum?: string }
}

export async function calendarRoutes(app: FastifyInstance) {
  // Yakında vizyona girecekler — TMDB's curated "upcoming" list for a region.
  app.get('/api/calendar/upcoming', async (req) => {
    const { page, region, ui_language } = querySchema.parse(req.query)
    const data = await tmdb<UpcomingResponse>('/movie/upcoming', {
      page: String(page),
      region,
      language: ui_language,
    })
    return { ...data, results: clipToDateWindow(data.results, data.dates) }
  })

  // Sinemada şu an — TMDB's "now playing" for the region.
  app.get('/api/calendar/now-playing', async (req) => {
    const { page, region, ui_language } = querySchema.parse(req.query)
    const data = await tmdb<UpcomingResponse>('/movie/now_playing', {
      page: String(page),
      region,
      language: ui_language,
    })
    return { ...data, results: clipToDateWindow(data.results, data.dates) }
  })
}
