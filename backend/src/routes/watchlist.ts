import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { rlRead, rlWrite } from '../lib/rateLimit.js'
import { serializeWatchlist } from '../lib/serializers.js'

const mediaTypeEnum = z.enum(['movie', 'tv']).default('movie')

const addBody = z.object({
  tmdb_id: z.number().int().positive(),
  media_type: mediaTypeEnum,
  title: z.string().min(1).max(500),
  poster_path: z.string().nullable().optional(),
  priority: z.number().int().min(-100).max(100).optional(),
})

const idParam = z.object({ tmdbId: z.coerce.number().int().positive() })
const mediaTypeQuery = z.object({ media_type: mediaTypeEnum })
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function watchlistRoutes(app: FastifyInstance) {
  app.get('/api/watchlist', rlRead, async (req) => {
    const userId = await app.requireAuth(req)
    const { page, limit } = pageQuery.parse(req.query)
    const rows = await app.services.watchlist.getWatchlist(userId, page, limit)
    
    return {
      items: rows.map(serializeWatchlist),
      page,
      limit,
    }
  })

  app.post('/api/watchlist', rlWrite, async (req) => {
    const userId = await app.requireAuth(req)
    const body = addBody.parse(req.body)

    await app.services.watchlist.addToWatchlist(userId, {
      tmdbId: body.tmdb_id,
      mediaType: body.media_type,
      title: body.title,
      posterPath: body.poster_path,
      priority: body.priority,
    })
    return { ok: true }
  })

  app.delete('/api/watchlist/:tmdbId', rlWrite, async (req) => {
    const userId = await app.requireAuth(req)
    const { tmdbId } = idParam.parse(req.params)
    const { media_type } = mediaTypeQuery.parse(req.query)
    
    await app.services.watchlist.removeFromWatchlist(userId, tmdbId, media_type)
    return { ok: true }
  })
}

