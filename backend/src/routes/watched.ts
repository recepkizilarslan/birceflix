import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { rlRead, rlWrite } from '../lib/rateLimit.js'
import { serializeWatched } from '../lib/serializers.js'

const mediaTypeEnum = z.enum(['movie', 'tv']).default('movie')

const upsertBody = z.object({
  tmdb_id: z.number().int().positive(),
  media_type: mediaTypeEnum,
  imdb_id: z.string().nullable().optional(),
  title: z.string().min(1).max(500),
  poster_path: z.string().nullable().optional(),
  my_rating: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const patchBody = z.object({
  my_rating: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const idParam = z.object({ tmdbId: z.coerce.number().int().positive() })
const mediaTypeQuery = z.object({ media_type: mediaTypeEnum })
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function watchedRoutes(app: FastifyInstance) {
  app.get('/api/watched', rlRead, async (req) => {
    const userId = await app.requireAuth(req)
    const { page, limit } = pageQuery.parse(req.query)
    const rows = await app.services.watched.getWatched(userId, page, limit)
    
    return {
      items: rows.map(serializeWatched),
      page,
      limit,
    }
  })

  app.post('/api/watched', rlWrite, async (req) => {
    const userId = await app.requireAuth(req)
    const body = upsertBody.parse(req.body)

    await app.services.watched.upsertWatched(userId, {
      tmdbId: body.tmdb_id,
      mediaType: body.media_type,
      imdbId: body.imdb_id,
      title: body.title,
      posterPath: body.poster_path,
      myRating: body.my_rating,
      notes: body.notes,
    })

    return { ok: true }
  })

  app.get('/api/watched/:tmdbId', rlRead, async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { tmdbId } = idParam.parse(req.params)
    const { media_type } = mediaTypeQuery.parse(req.query)
    
    const row = await app.services.watched.getWatchedItem(userId, tmdbId, media_type)
    if (!row) return reply.code(404).send({ error: 'not found' })
    return serializeWatched(row)
  })

  app.patch('/api/watched/:tmdbId', rlWrite, async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { tmdbId } = idParam.parse(req.params)
    const { media_type } = mediaTypeQuery.parse(req.query)
    const body = patchBody.parse(req.body)

    if (body.my_rating === undefined && body.notes === undefined) {
      return reply.code(400).send({ error: 'nothing to update' })
    }

    const updated = await app.services.watched.updateWatched(userId, tmdbId, media_type, {
      myRating: body.my_rating,
      notes: body.notes,
    })

    if (!updated) {
      return reply.code(404).send({ error: 'not found — mark as watched first' })
    }
    return { ok: true }
  })

  app.delete('/api/watched/:tmdbId', rlWrite, async (req) => {
    const userId = await app.requireAuth(req)
    const { tmdbId } = idParam.parse(req.params)
    const { media_type } = mediaTypeQuery.parse(req.query)
    
    await app.services.watched.deleteWatched(userId, tmdbId, media_type)
    return { ok: true }
  })
}

