import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { uiLanguageSchema } from '../lib/locale.js'

const querySchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().default(1),
  ui_language: uiLanguageSchema,
})

export async function searchRoutes(app: FastifyInstance) {
  app.get('/api/search', async (req) => {
    const { q, page, ui_language } = querySchema.parse(req.query)
    return tmdb('/search/movie', {
      query: q,
      page: String(page),
      language: ui_language,
      include_adult: 'false',
    })
  })
}
