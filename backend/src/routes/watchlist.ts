import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { watchlist } from '../db/schema.js'

const addBody = z.object({
  tmdb_id: z.number().int().positive(),
  title: z.string().min(1).max(500),
  poster_path: z.string().nullable().optional(),
  priority: z.number().int().min(-100).max(100).optional(),
})

const idParam = z.object({ tmdbId: z.coerce.number().int().positive() })

export async function watchlistRoutes(app: FastifyInstance) {
  app.get('/api/watchlist', async (req) => {
    const userId = await app.requireAuth(req)
    const rows = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(desc(watchlist.priority), desc(watchlist.addedAt))

    return rows.map((r) => ({
      user_id: r.userId,
      tmdb_id: r.tmdbId,
      title: r.title,
      poster_path: r.posterPath,
      added_at: r.addedAt.toISOString(),
      priority: r.priority,
    }))
  })

  app.post('/api/watchlist', async (req) => {
    const userId = await app.requireAuth(req)
    const body = addBody.parse(req.body)

    await db
      .insert(watchlist)
      .values({
        userId,
        tmdbId: body.tmdb_id,
        title: body.title,
        posterPath: body.poster_path ?? null,
        priority: body.priority ?? 0,
      })
      .onConflictDoUpdate({
        target: [watchlist.userId, watchlist.tmdbId],
        // Keep title/poster fresh in case TMDB updated them; preserve added_at.
        set: {
          title: body.title,
          posterPath: body.poster_path ?? null,
          priority: body.priority ?? 0,
        },
      })
    return { ok: true }
  })

  app.delete('/api/watchlist/:tmdbId', async (req) => {
    const userId = await app.requireAuth(req)
    const { tmdbId } = idParam.parse(req.params)
    await db
      .delete(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.tmdbId, tmdbId)))
    return { ok: true }
  })
}
