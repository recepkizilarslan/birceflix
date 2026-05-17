import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { watchedMovies } from '../db/schema.js'

const upsertBody = z.object({
  tmdb_id: z.number().int().positive(),
  imdb_id: z.string().nullable().optional(),
  title: z.string().min(1).max(500),
  poster_path: z.string().nullable().optional(),
  my_rating: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const idParam = z.object({ tmdbId: z.coerce.number().int().positive() })

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
        imdbId: body.imdb_id ?? null,
        title: body.title,
        posterPath: body.poster_path ?? null,
        myRating: body.my_rating ?? null,
        notes: body.notes ?? null,
      })
      .onConflictDoUpdate({
        target: [watchedMovies.userId, watchedMovies.tmdbId],
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

  app.delete('/api/watched/:tmdbId', async (req) => {
    const userId = await app.requireAuth(req)
    const { tmdbId } = idParam.parse(req.params)
    await db
      .delete(watchedMovies)
      .where(and(eq(watchedMovies.userId, userId), eq(watchedMovies.tmdbId, tmdbId)))
    return { ok: true }
  })
}
