import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { watchedEpisodes } from '../db/schema.js'
import { rlRead, rlWrite } from '../lib/rateLimit.js'

const markBody = z.object({
  show_id: z.number().int().positive(),
  show_name: z.string().min(1).max(500),
  show_poster_path: z.string().nullable().optional(),
  season_number: z.number().int().min(0),
  episode_number: z.number().int().min(0),
  episode_name: z.string().nullable().optional(),
  my_rating: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const bulkBody = z.object({
  show_id: z.number().int().positive(),
  show_name: z.string().min(1).max(500),
  show_poster_path: z.string().nullable().optional(),
  season_number: z.number().int().min(0),
  episodes: z.array(z.object({
    number: z.number().int().min(0),
    name: z.string().nullable().optional(),
  })).min(1).max(200),
})

const showIdParam = z.object({ showId: z.coerce.number().int().positive() })
const episodeKey = z.object({
  showId: z.coerce.number().int().positive(),
  season: z.coerce.number().int().min(0),
  episode: z.coerce.number().int().min(0),
})
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function watchedEpisodeRoutes(app: FastifyInstance) {
  // List all watched episodes for one show (current user)
  app.get('/api/watched-episodes/:showId', { config: rlRead.config }, async (req) => {
    const userId = await app.requireAuth(req)
    const { showId } = showIdParam.parse(req.params)
    const rows = await db
      .select()
      .from(watchedEpisodes)
      .where(and(eq(watchedEpisodes.userId, userId), eq(watchedEpisodes.showId, showId)))
      .orderBy(desc(watchedEpisodes.watchedAt))
    return rows.map(serialise)
  })

  // Per-show counts — used by the watched-shows summary list
  app.get('/api/watched-episodes', { config: rlRead.config }, async (req) => {
    const userId = await app.requireAuth(req)
    const rows = await db
      .select({
        show_id: watchedEpisodes.showId,
        show_name: sql<string>`max(${watchedEpisodes.showName})`.as('show_name'),
        show_poster_path: sql<string | null>`max(${watchedEpisodes.showPosterPath})`.as('show_poster_path'),
        episode_count: sql<number>`count(*)::int`.as('episode_count'),
        last_watched_at: sql<string>`max(${watchedEpisodes.watchedAt})::text`.as('last_watched_at'),
      })
      .from(watchedEpisodes)
      .where(eq(watchedEpisodes.userId, userId))
      .groupBy(watchedEpisodes.showId)
      .orderBy(desc(sql`max(${watchedEpisodes.watchedAt})`))

    const { page, limit } = pageQuery.parse(req.query)
    const paginatedRows = rows.slice((page - 1) * limit, page * limit)

    return {
      items: paginatedRows,
      page,
      limit,
    }
  })

  // Mark a single episode
  app.post('/api/watched-episodes', { config: rlWrite.config }, async (req) => {
    const userId = await app.requireAuth(req)
    const body = markBody.parse(req.body)
    await db
      .insert(watchedEpisodes)
      .values({
        userId,
        showId: body.show_id,
        showName: body.show_name,
        showPosterPath: body.show_poster_path ?? null,
        seasonNumber: body.season_number,
        episodeNumber: body.episode_number,
        episodeName: body.episode_name ?? null,
        myRating: body.my_rating ?? null,
        notes: body.notes ?? null,
      })
      .onConflictDoUpdate({
        target: [
          watchedEpisodes.userId,
          watchedEpisodes.showId,
          watchedEpisodes.seasonNumber,
          watchedEpisodes.episodeNumber,
        ],
        set: {
          showName: body.show_name,
          showPosterPath: body.show_poster_path ?? null,
          episodeName: body.episode_name ?? null,
          myRating: body.my_rating ?? null,
          notes: body.notes ?? null,
        },
      })
    return { ok: true }
  })

  // Mark a whole season at once — used by the "tüm sezon" toggle
  app.post('/api/watched-episodes/bulk', { config: rlWrite.config }, async (req) => {
    const userId = await app.requireAuth(req)
    const body = bulkBody.parse(req.body)
    const rows = body.episodes.map((e) => ({
      userId,
      showId: body.show_id,
      showName: body.show_name,
      showPosterPath: body.show_poster_path ?? null,
      seasonNumber: body.season_number,
      episodeNumber: e.number,
      episodeName: e.name ?? null,
    }))
    await db
      .insert(watchedEpisodes)
      .values(rows)
      .onConflictDoNothing({
        target: [
          watchedEpisodes.userId,
          watchedEpisodes.showId,
          watchedEpisodes.seasonNumber,
          watchedEpisodes.episodeNumber,
        ],
      })
    return { ok: true, count: rows.length }
  })

  // Unmark a single episode
  app.delete('/api/watched-episodes/:showId/:season/:episode', { config: rlWrite.config }, async (req) => {
    const userId = await app.requireAuth(req)
    const { showId, season, episode } = episodeKey.parse(req.params)
    await db
      .delete(watchedEpisodes)
      .where(
        and(
          eq(watchedEpisodes.userId, userId),
          eq(watchedEpisodes.showId, showId),
          eq(watchedEpisodes.seasonNumber, season),
          eq(watchedEpisodes.episodeNumber, episode),
        ),
      )
    return { ok: true }
  })

  // Unmark an entire season
  app.delete('/api/watched-episodes/:showId/:season', { config: rlWrite.config }, async (req) => {
    const userId = await app.requireAuth(req)
    const { showId, season } = z
      .object({ showId: z.coerce.number().int().positive(), season: z.coerce.number().int().min(0) })
      .parse(req.params)
    await db
      .delete(watchedEpisodes)
      .where(
        and(
          eq(watchedEpisodes.userId, userId),
          eq(watchedEpisodes.showId, showId),
          eq(watchedEpisodes.seasonNumber, season),
        ),
      )
    return { ok: true }
  })
}

function serialise(r: typeof watchedEpisodes.$inferSelect) {
  return {
    id: r.id,
    show_id: r.showId,
    show_name: r.showName,
    show_poster_path: r.showPosterPath,
    season_number: r.seasonNumber,
    episode_number: r.episodeNumber,
    episode_name: r.episodeName,
    watched_at: r.watchedAt.toISOString(),
    my_rating: r.myRating,
    notes: r.notes,
  }
}
