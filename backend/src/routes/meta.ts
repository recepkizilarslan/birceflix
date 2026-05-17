import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { env } from '../env.js'

interface ProviderRow {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

export async function metaRoutes(app: FastifyInstance) {
  app.get('/api/genres', async () => {
    const data = await tmdb<{ genres: { id: number; name: string }[] }>('/genre/movie/list', {
      language: 'en-US',
    })
    return data.genres
  })

  app.get('/api/providers', async (req) => {
    const { region } = z
      .object({ region: z.string().length(2).default(env.DEFAULT_WATCH_REGION) })
      .parse(req.query)
    const data = await tmdb<{ results: ProviderRow[] }>('/watch/providers/movie', {
      language: 'en-US',
      watch_region: region,
    })
    return data.results
  })
}
