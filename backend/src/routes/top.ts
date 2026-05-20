import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '../env.js'
import { getTop, getTopStatus } from '../lib/topCache.js'

const querySchema = z.object({
  region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
  media_type: z.enum(['movie', 'tv']).default('movie'),
})

export async function topRoutes(app: FastifyInstance) {
  app.get('/api/top', async (req) => {
    const { region, media_type } = querySchema.parse(req.query)
    return getTop(media_type, region.toUpperCase(), app.log)
  })

  // Debug-only: timestamps + error strings, no user data.
  app.get('/api/top/status', async () => ({ snapshots: getTopStatus() }))
}
