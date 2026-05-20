import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
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

async function writeScrobble(userId: string, ev: ScrobbleEvent) {
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

    await db.insert(watchHistory).values({
      userId,
      tmdbId: ev.tmdbId,
      watchedAt: ev.watchedAt,
    })
    return
  }

  // Episode
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
}

export async function webhookRoutes(app: FastifyInstance) {
  // -------- Token CRUD (auth required) ----------------------------------
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

  app.post('/api/webhooks', rlWrite, async (req) => {
    const userId = await app.requireAuth(req)
    const { label } = createBody.parse(req.body)
    const token = newToken()
    const [row] = await db
      .insert(webhookTokens)
      .values({ userId, label, token })
      .returning()
    // Returned ONCE in full — the UI shows the URL with it.
    return serialise(row!, true)
  })

  app.delete('/api/webhooks/:id', rlWrite, async (req) => {
    const userId = await app.requireAuth(req)
    const { id } = idParam.parse(req.params)
    await db
      .delete(webhookTokens)
      .where(and(eq(webhookTokens.id, id), eq(webhookTokens.userId, userId)))
    return { ok: true }
  })

  // -------- Scrobble receiver (no auth — token in URL) ------------------
  app.post('/api/webhooks/scrobble/:token', rlWebhook, async (req, reply) => {
    const { token } = tokenParam.parse(req.params)
    const [row] = await db
      .select({ id: webhookTokens.id, userId: webhookTokens.userId })
      .from(webhookTokens)
      .where(eq(webhookTokens.token, token))
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

    await writeScrobble(row.userId, ev)
    await db
      .update(webhookTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(webhookTokens.id, row.id))

    req.log.info({ source: ev.source, kind: ev.kind, userId: row.userId }, 'scrobble accepted')
    return { ok: true, kind: ev.kind, source: ev.source }
  })

  // Silence unused-import warning in some configurations
  void sql
}
