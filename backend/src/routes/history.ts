import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { watchHistory } from '../db/schema.js'
import { rlRead, rlWrite } from '../lib/rateLimit.js'

const tmdbParam = z.object({ tmdbId: z.coerce.number().int().positive() })
const idParam = z.object({ id: z.string().uuid() })

const addBody = z.object({
  tmdb_id: z.number().int().positive(),
  /** ISO date or datetime string. Defaults to now() server-side. */
  watched_at: z.string().datetime().optional().or(z.string().date().optional()),
  my_rating: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const patchBody = z.object({
  watched_at: z.string().datetime().optional().or(z.string().date().optional()),
  my_rating: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

type HistoryRow = typeof watchHistory.$inferSelect

function serialise(r: HistoryRow) {
  return {
    id: r.id,
    user_id: r.userId,
    tmdb_id: r.tmdbId,
    watched_at: r.watchedAt.toISOString(),
    my_rating: r.myRating,
    notes: r.notes,
  }
}

function parseWatchedAt(s: string | undefined): Date | undefined {
  if (!s) return undefined
  // Accepts both date-only ('2026-03-14') and datetime ISO strings.
  const d = new Date(s.length === 10 ? `${s}T12:00:00Z` : s)
  if (Number.isNaN(d.getTime())) throw new Error('invalid watched_at')
  return d
}

export async function historyRoutes(app: FastifyInstance) {
  app.get('/api/history/:tmdbId', rlRead, async (req) => {
    const userId = await app.requireAuth(req)
    const { tmdbId } = tmdbParam.parse(req.params)
    const rows = await db
      .select()
      .from(watchHistory)
      .where(and(eq(watchHistory.userId, userId), eq(watchHistory.tmdbId, tmdbId)))
      .orderBy(desc(watchHistory.watchedAt))
    return rows.map(serialise)
  })

  app.post('/api/history', rlWrite, async (req, reply) => {
    const userId = await app.requireAuth(req)
    const body = addBody.parse(req.body)
    const watchedAt = parseWatchedAt(body.watched_at)

    const [row] = await db
      .insert(watchHistory)
      .values({
        userId,
        tmdbId: body.tmdb_id,
        ...(watchedAt ? { watchedAt } : {}),
        myRating: body.my_rating ?? null,
        notes: body.notes ?? null,
      })
      .returning()
    if (!row) return reply.code(500).send({ error: 'failed to add history' })
    return serialise(row)
  })

  app.patch('/api/history/:id', rlWrite, async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { id } = idParam.parse(req.params)
    const body = patchBody.parse(req.body)

    if (
      body.watched_at === undefined &&
      body.my_rating === undefined &&
      body.notes === undefined
    ) {
      return reply.code(400).send({ error: 'nothing to update' })
    }

    const update: Partial<{
      watchedAt: Date
      myRating: number | null
      notes: string | null
    }> = {}
    const watchedAt = parseWatchedAt(body.watched_at)
    if (watchedAt) update.watchedAt = watchedAt
    if (body.my_rating !== undefined) update.myRating = body.my_rating ?? null
    if (body.notes !== undefined) update.notes = body.notes ?? null

    const [row] = await db
      .update(watchHistory)
      .set(update)
      .where(and(eq(watchHistory.id, id), eq(watchHistory.userId, userId)))
      .returning()
    if (!row) return reply.code(404).send({ error: 'not found' })
    return serialise(row)
  })

  app.delete('/api/history/:id', rlWrite, async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { id } = idParam.parse(req.params)
    const deleted = await db
      .delete(watchHistory)
      .where(and(eq(watchHistory.id, id), eq(watchHistory.userId, userId)))
      .returning({ id: watchHistory.id })
    if (deleted.length === 0) return reply.code(404).send({ error: 'not found' })
    return { ok: true }
  })
}
