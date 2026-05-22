import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { randomBytes, createHash } from 'node:crypto'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { watchedEpisodes, watchedMovies, watchHistory, webhookTokens } from '../db/schema.js'
import { parseJellyfin, parsePlex, type ScrobbleEvent } from '../lib/scrobblers.js'
import { rlRead, rlWrite, rlWebhook } from '../lib/rateLimit.js'

const createBody = z.object({
  label: z.string().min(1).max(120),
})

const idParam = z.object({ id: z.string().uuid() })
const tokenParam = z.object({ token: z.string().min(16).max(96) })

function newToken(): string {
  return randomBytes(24).toString('base64url')
}

function serialise(t: typeof webhookTokens.$inferSelect, includeToken: boolean) {
  return {
    id: t.id,
    label: t.label,
    /** Only returned on creation; subsequent reads expose just the suffix. */
    token: includeToken ? t.token : null,
    token_suffix: t.token.slice(-6),
    last_used_at: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
    created_at: t.createdAt.toISOString(),
  }
}

/**
 * Plex POSTs multipart/form-data with a `payload` form field.
 * @fastify/multipart's "attachFieldsToBody" isn't enabled globally, so we
 * iterate the parts manually.
 */
async function readPlexPayload(req: FastifyRequest): Promise<unknown> {
  // .parts() yields both file and field parts; we want the 'payload' field.
  const reqAny = req as unknown as { parts: () => AsyncIterable<{ type: string; fieldname: string; value?: unknown }> }
  if (typeof reqAny.parts !== 'function') return null
  for await (const part of reqAny.parts()) {
    if (part.type === 'field' && part.fieldname === 'payload') {
      try {
        return JSON.parse(String(part.value))
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * If a `watch_history` row already exists for this (user, tmdb_id) within
 * SCROBBLE_DEDUP_WINDOW_MS of the incoming event, treat it as a duplicate.
 *
 * Plex sets `watchedAt = new Date()` at the receiver (see lib/scrobblers.ts),
 * so an exact-timestamp match doesn't help — a retried `media.scrobble`
 * lands seconds later with a different timestamp. A 2-minute window catches
 * sane retries (Plex retry backoff is on the order of seconds) without
 * swallowing legitimate rewatches in the same session.
 */
const SCROBBLE_DEDUP_WINDOW_MS = 2 * 60 * 1000

async function watchHistoryDuplicateExists(
  userId: string,
  tmdbId: number,
  at: Date,
): Promise<boolean> {
  const lo = new Date(at.getTime() - SCROBBLE_DEDUP_WINDOW_MS)
  const hi = new Date(at.getTime() + SCROBBLE_DEDUP_WINDOW_MS)
  const [row] = await db
    .select({ id: watchHistory.id })
    .from(watchHistory)
    .where(
      and(
        eq(watchHistory.userId, userId),
        eq(watchHistory.tmdbId, tmdbId),
        gte(watchHistory.watchedAt, lo),
        lte(watchHistory.watchedAt, hi),
      ),
    )
    .limit(1)
  return !!row
}

async function writeScrobble(userId: string, ev: ScrobbleEvent): Promise<'wrote' | 'deduped'> {
  if (ev.kind === 'movie') {
    await db
      .insert(watchedMovies)
      .values({
        userId,
        tmdbId: ev.tmdbId,
        imdbId: ev.imdbId,
        title: ev.title,
        posterPath: null,
      })
      .onConflictDoNothing({ target: [watchedMovies.userId, watchedMovies.tmdbId] })

    if (await watchHistoryDuplicateExists(userId, ev.tmdbId, ev.watchedAt)) {
      return 'deduped'
    }
    await db.insert(watchHistory).values({
      userId,
      tmdbId: ev.tmdbId,
      watchedAt: ev.watchedAt,
    })
    return 'wrote'
  }

  // Episode: dedup happens at the row level via the composite unique index;
  // onConflictDoUpdate refreshes the watchedAt instead of stacking duplicates,
  // so a Plex retry doesn't create a second episode row.
  await db
    .insert(watchedEpisodes)
    .values({
      userId,
      showId: ev.showId,
      showName: ev.showName,
      showPosterPath: ev.showPosterPath,
      seasonNumber: ev.seasonNumber,
      episodeNumber: ev.episodeNumber,
      episodeName: ev.episodeName,
      watchedAt: ev.watchedAt,
    })
    .onConflictDoUpdate({
      target: [
        watchedEpisodes.userId,
        watchedEpisodes.showId,
        watchedEpisodes.seasonNumber,
        watchedEpisodes.episodeNumber,
      ],
      // Touch watchedAt so the scrobble timestamp wins over manual marks.
      set: { watchedAt: ev.watchedAt, episodeName: ev.episodeName, showName: ev.showName },
    })
  return 'wrote'
}

export async function webhookRoutes(app: FastifyInstance) {
  // -------- Token CRUD (auth required) ----------------------------------
  // lgtm [js/missing-rate-limiting]
  app.get('/api/webhooks', rlRead, async (req) => {
    const userId = await app.requireAuth(req)
    const rows = await db
      .select()
      .from(webhookTokens)
      .where(eq(webhookTokens.userId, userId))
      .orderBy(desc(webhookTokens.createdAt))
    // Never expose the raw token on read.
    return rows.map((r) => serialise(r, false))
  })

  // lgtm [js/missing-rate-limiting]
  app.post('/api/webhooks', rlWrite, async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { label } = createBody.parse(req.body)
    const token = newToken()
    const hashedToken = createHash('sha256').update(token).digest('hex')
    const [row] = await db
      .insert(webhookTokens)
      .values({ userId, label, token: hashedToken })
      .returning()
    if (!row) return reply.code(500).send({ error: 'failed to create webhook' })
    // Returned ONCE in full — the UI shows the URL with it.
    return { ...serialise(row, false), token }
  })

  // lgtm [js/missing-rate-limiting]
  app.delete('/api/webhooks/:id', rlWrite, async (req) => {
    const userId = await app.requireAuth(req)
    const { id } = idParam.parse(req.params)
    await db
      .delete(webhookTokens)
      .where(and(eq(webhookTokens.id, id), eq(webhookTokens.userId, userId)))
    return { ok: true }
  })

  // -------- Scrobble receiver (no auth — token in URL) ------------------
  // lgtm [js/missing-rate-limiting]
  app.post('/api/webhooks/scrobble/:token', rlWebhook, async (req, reply) => {
    const { token } = tokenParam.parse(req.params)
    const hashedToken = createHash('sha256').update(token).digest('hex')
    const [row] = await db
      .select({ id: webhookTokens.id, userId: webhookTokens.userId })
      .from(webhookTokens)
      .where(eq(webhookTokens.token, hashedToken))
      .limit(1)
    if (!row) return reply.code(404).send({ error: 'unknown token' })

    const ct = (req.headers['content-type'] ?? '').toLowerCase()
    let payload: unknown
    if (ct.includes('multipart/form-data')) {
      payload = await readPlexPayload(req)
    } else {
      payload = req.body
    }

    // Try Plex first (it has the distinctive 'event' field), fall back to Jellyfin.
    const ev = parsePlex(payload) ?? parseJellyfin(payload)
    if (!ev) {
      // Not an error — Plex sends play/pause/rate to the same URL.
      // Just acknowledge so the source doesn't retry.
      await db
        .update(webhookTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(webhookTokens.id, row.id))
      return reply.code(204).send()
    }

    const result = await writeScrobble(row.userId, ev)
    await db
      .update(webhookTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(webhookTokens.id, row.id))

    req.log.info(
      { source: ev.source, kind: ev.kind, userId: row.userId, deduped: result === 'deduped' },
      result === 'deduped' ? 'scrobble deduped' : 'scrobble accepted',
    )
    return { ok: true, kind: ev.kind, source: ev.source, deduped: result === 'deduped' }
  })

  // Silence unused-import warning in some configurations
  void sql
}
