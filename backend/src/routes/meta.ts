import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { uiLanguageSchema } from '../lib/locale.js'
import { env } from '../env.js'

interface ProviderRow {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

const genresQuery = z.object({
  ui_language: uiLanguageSchema,
})

export async function metaRoutes(app: FastifyInstance) {
  app.get('/api/genres', async (req) => {
    const { ui_language } = genresQuery.parse(req.query)
    const data = await tmdb<{ genres: { id: number; name: string }[] }>('/genre/movie/list', {
      language: ui_language,
    })
    return data.genres
  })

  app.get('/api/providers', async (req) => {
    const { region, ui_language } = z
      .object({
        region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
        ui_language: uiLanguageSchema,
      })
      .parse(req.query)
    const data = await tmdb<{ results: ProviderRow[] }>('/watch/providers/movie', {
      language: ui_language,
      watch_region: region,
    })
    return data.results
  })
}
