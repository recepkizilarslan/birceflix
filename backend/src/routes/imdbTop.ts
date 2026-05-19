import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '../env.js'
import { getImdbTop, getImdbTopStatus } from '../lib/imdbTopCache.js'

const querySchema = z.object({
  region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
})

export async function imdbTopRoutes(app: FastifyInstance) {
  app.get('/api/imdb-top', async (req) => {
    const { region } = querySchema.parse(req.query)
    return getImdbTop(region.toUpperCase(), app.log)
  })

  // Debug endpoint: cheap, no auth needed for now since it just exposes
  // the refresh state (timestamps + error strings, no user data).
  app.get('/api/imdb-top/status', async () => ({ regions: getImdbTopStatus() }))
}
