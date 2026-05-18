import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'

const idParam = z.object({ id: z.coerce.number().int().positive() })
const seasonParam = z.object({
  id: z.coerce.number().int().positive(),
  season: z.coerce.number().int().min(0),
})
const searchQuery = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().default(1),
  ui_language: z.string().default('en-US'),
})
const popularQuery = z.object({
  page: z.coerce.number().default(1),
  ui_language: z.string().default('en-US'),
})

export async function tvRoutes(app: FastifyInstance) {
  // TV show detail (with credits + external ids in case we want IMDB later)
  app.get('/api/tv/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    return tmdb(`/tv/${id}`, {
      append_to_response: 'credits,external_ids,videos',
      language: 'en-US',
    })
  })

  // Single season — TMDB returns episode list with air_date, runtime, etc.
  app.get('/api/tv/:id/season/:season', async (req) => {
    const { id, season } = seasonParam.parse(req.params)
    return tmdb(`/tv/${id}/season/${season}`, {
      language: 'en-US',
    })
  })

  app.get('/api/tv/search', async (req) => {
    const { q, page, ui_language } = searchQuery.parse(req.query)
    return tmdb('/search/tv', {
      query: q,
      page: String(page),
      language: ui_language,
      include_adult: 'false',
    })
  })

  // Popular TV shows — discover entry point, no filter UI yet
  app.get('/api/tv/popular', async (req) => {
    const { page, ui_language } = popularQuery.parse(req.query)
    return tmdb('/tv/popular', {
      page: String(page),
      language: ui_language,
    })
  })
}
