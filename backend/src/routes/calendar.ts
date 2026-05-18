import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { env } from '../env.js'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
  ui_language: z.string().default('en-US'),
})

export async function calendarRoutes(app: FastifyInstance) {
  // Yakında vizyona girecekler — TMDB's curated "upcoming" list for a region.
  app.get('/api/calendar/upcoming', async (req) => {
    const { page, region, ui_language } = querySchema.parse(req.query)
    return tmdb('/movie/upcoming', {
      page: String(page),
      region,
      language: ui_language,
    })
  })

  // Sinemada şu an — TMDB's "now playing" for the region.
  app.get('/api/calendar/now-playing', async (req) => {
    const { page, region, ui_language } = querySchema.parse(req.query)
    return tmdb('/movie/now_playing', {
      page: String(page),
      region,
      language: ui_language,
    })
  })
}
