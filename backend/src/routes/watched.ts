import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { watchedMovies } from '../db/schema.js'

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

export async function watchedRoutes(app: FastifyInstance) {
  app.get('/api/watched', async (req) => {
    const userId = await app.requireAuth(req)
    const rows = await db
      .select()
      .from(watchedMovies)
      .where(eq(watchedMovies.userId, userId))
      .orderBy(desc(watchedMovies.watchedAt))

    return rows.map((r) => ({
      id: r.id,
      user_id: r.userId,
      tmdb_id: r.tmdbId,
      media_type: r.mediaType,
      imdb_id: r.imdbId,
      title: r.title,
      poster_path: r.posterPath,
      watched_at: r.watchedAt.toISOString(),
      my_rating: r.myRating,
      notes: r.notes,
    }))
  })

  app.post('/api/watched', async (req) => {
    const userId = await app.requireAuth(req)
    const body = upsertBody.parse(req.body)

    await db
      .insert(watchedMovies)
      .values({
        userId,
        tmdbId: body.tmdb_id,
        mediaType: body.media_type,
        imdbId: body.imdb_id ?? null,
        title: body.title,
        posterPath: body.poster_path ?? null,
        myRating: body.my_rating ?? null,
        notes: body.notes ?? null,
      })
      .onConflictDoUpdate({
        target: [watchedMovies.userId, watchedMovies.tmdbId, watchedMovies.mediaType],
        set: {
          imdbId: body.imdb_id ?? null,
          title: body.title,
          posterPath: body.poster_path ?? null,
          myRating: body.my_rating ?? null,
          notes: body.notes ?? null,
        },
      })

    return { ok: true }
  })

  app.get('/api/watched/:tmdbId', async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { tmdbId } = idParam.parse(req.params)
    const { media_type } = mediaTypeQuery.parse(req.query)
    const [row] = await db
      .select()
      .from(watchedMovies)
      .where(and(
        eq(watchedMovies.userId, userId),
        eq(watchedMovies.tmdbId, tmdbId),
        eq(watchedMovies.mediaType, media_type),
      ))
      .limit(1)
    if (!row) return reply.code(404).send({ error: 'not found' })
    return {
      id: row.id,
      user_id: row.userId,
      tmdb_id: row.tmdbId,
      media_type: row.mediaType,
      imdb_id: row.imdbId,
      title: row.title,
      poster_path: row.posterPath,
      watched_at: row.watchedAt.toISOString(),
      my_rating: row.myRating,
      notes: row.notes,
    }
  })

  app.patch('/api/watched/:tmdbId', async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { tmdbId } = idParam.parse(req.params)
    const { media_type } = mediaTypeQuery.parse(req.query)
    const body = patchBody.parse(req.body)

    if (body.my_rating === undefined && body.notes === undefined) {
      return reply.code(400).send({ error: 'nothing to update' })
    }

    const update: Partial<{ myRating: number | null; notes: string | null }> = {}
    if (body.my_rating !== undefined) update.myRating = body.my_rating ?? null
    if (body.notes !== undefined) update.notes = body.notes ?? null

    const result = await db
      .update(watchedMovies)
      .set(update)
      .where(and(
        eq(watchedMovies.userId, userId),
        eq(watchedMovies.tmdbId, tmdbId),
        eq(watchedMovies.mediaType, media_type),
      ))
      .returning({ id: watchedMovies.id })

    if (result.length === 0) {
      return reply.code(404).send({ error: 'not found — mark as watched first' })
    }
    return { ok: true }
  })

  app.delete('/api/watched/:tmdbId', async (req) => {
    const userId = await app.requireAuth(req)
    const { tmdbId } = idParam.parse(req.params)
    const { media_type } = mediaTypeQuery.parse(req.query)
    await db
      .delete(watchedMovies)
      .where(and(
        eq(watchedMovies.userId, userId),
        eq(watchedMovies.tmdbId, tmdbId),
        eq(watchedMovies.mediaType, media_type),
      ))
    return { ok: true }
  })
}
