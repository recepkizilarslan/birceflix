import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, watchedMovies, watchHistory } from '../db/schema.js'
import { env } from '../env.js'
import {
  authorizationUrl,
  exchangeCode,
  getHistoryPage,
  refreshAccessToken,
  tokenIsFresh,
  traktConfigured,
  type TraktHistoryItem,
  type TraktTokens,
} from '../lib/trakt.js'
import { rlAuth, rlRead, rlWrite } from '../lib/rateLimit.js'
import { encrypt, decrypt } from '../lib/crypto.js'

const STATE_COOKIE = 'trakt_oauth_state'

function tokenExpiresAt(t: TraktTokens): Date {
  // Trakt returns created_at (unix seconds) + expires_in (seconds).
  return new Date((t.created_at + t.expires_in) * 1000)
}

/** Get a valid access token for the user, refreshing if needed. Returns null if not connected. */
async function getValidToken(userId: string): Promise<string | null> {
  const [row] = await db
    .select({
      access: users.traktAccessToken,
      refresh: users.traktRefreshToken,
      expires: users.traktExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!row || !row.access || !row.refresh) return null

  if (tokenIsFresh(row.expires)) return decrypt(row.access)

  // Refresh
  const fresh = await refreshAccessToken(decrypt(row.refresh))
  await db
    .update(users)
    .set({
      traktAccessToken: encrypt(fresh.access_token),
      traktRefreshToken: encrypt(fresh.refresh_token),
      traktExpiresAt: tokenExpiresAt(fresh),
    })
    .where(eq(users.id, userId))
  return fresh.access_token
}

export async function integrationsRoutes(app: FastifyInstance) {
  // -------- Status -------------------------------------------------------
  // lgtm [js/missing-rate-limiting]
  app.get('/api/integrations/trakt/status', rlRead, async (req) => {
    const userId = await app.requireAuth(req)
    if (!traktConfigured()) return { configured: false, connected: false, last_sync_at: null }

    const [row] = await db
      .select({
        access: users.traktAccessToken,
        lastSync: users.traktLastSyncAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    return {
      configured: true,
      connected: !!row?.access,
      last_sync_at: row?.lastSync ? row.lastSync.toISOString() : null,
    }
  })

  // -------- Start OAuth --------------------------------------------------
  // lgtm [js/missing-rate-limiting]
  app.get('/api/integrations/trakt/connect', rlAuth, async (req, reply) => {
    await app.requireAuth(req)
    if (!traktConfigured()) return reply.code(503).send({ error: 'trakt not configured' })

    const state = randomBytes(24).toString('base64url')
    reply.setCookie(STATE_COOKIE, state, {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
    })
    reply.redirect(authorizationUrl(state))
  })

  // -------- OAuth callback -----------------------------------------------
  // lgtm [js/missing-rate-limiting]
  app.get('/api/integrations/trakt/callback', rlAuth, async (req, reply) => {
    const userId = await app.requireAuth(req)
    if (!traktConfigured()) return reply.code(503).send({ error: 'trakt not configured' })

    const { code, state } = req.query as { code?: string; state?: string }
    const cookieState = req.cookies[STATE_COOKIE]
    if (!code || !state || !cookieState || state !== cookieState) {
      return reply.code(400).send({ error: 'invalid oauth state' })
    }

    const tokens = await exchangeCode(code)
    await db
      .update(users)
      .set({
        traktAccessToken: encrypt(tokens.access_token),
        traktRefreshToken: encrypt(tokens.refresh_token),
        traktExpiresAt: tokenExpiresAt(tokens),
      })
      .where(eq(users.id, userId))

    reply.clearCookie(STATE_COOKIE, { path: '/' })
    reply.redirect(`${env.FRONTEND_ORIGIN}/import`)
  })

  // -------- Disconnect ---------------------------------------------------
  // lgtm [js/missing-rate-limiting]
  app.post('/api/integrations/trakt/disconnect', rlWrite, async (req) => {
    const userId = await app.requireAuth(req)
    await db
      .update(users)
      .set({
        traktAccessToken: null,
        traktRefreshToken: null,
        traktExpiresAt: null,
        // Keep last_sync_at as a historical fact.
      })
      .where(eq(users.id, userId))
    return { ok: true }
  })

  // -------- Import history ----------------------------------------------
  // lgtm [js/missing-rate-limiting]
  app.post('/api/integrations/trakt/import-history', rlWrite, async (req, reply) => {
    const userId = await app.requireAuth(req)
    if (!traktConfigured()) return reply.code(503).send({ error: 'trakt not configured' })

    const accessToken = await getValidToken(userId)
    if (!accessToken) return reply.code(400).send({ error: 'not connected to trakt' })

    let imported = 0
    let skippedNoTmdb = 0
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const { items, totalPages: tp } = await getHistoryPage(accessToken, page)
      totalPages = tp

      for (const item of items) {
        const result = await importOne(userId, item)
        if (result === 'skipped') skippedNoTmdb++
        else if (result === 'imported') imported++
      }
      page++
      // Safety: don't loop forever
      if (page > 50) break
    }

    await db
      .update(users)
      .set({ traktLastSyncAt: new Date() })
      .where(eq(users.id, userId))

    return { imported, skipped_no_tmdb: skippedNoTmdb, pages_read: Math.min(page - 1, totalPages) }
  })
}

async function importOne(userId: string, item: TraktHistoryItem): Promise<'imported' | 'skipped'> {
  if (item.type !== 'movie' || !item.movie) return 'skipped'
  const tmdbId = item.movie.ids.tmdb
  if (!tmdbId) return 'skipped'

  const watchedAt = new Date(item.watched_at)

  // Make sure a watched_movies row exists (no rewrite if already there).
  await db
    .insert(watchedMovies)
    .values({
      userId,
      tmdbId,
      imdbId: item.movie.ids.imdb ?? null,
      title: item.movie.title,
      posterPath: null,
    })
    .onConflictDoNothing({ target: [watchedMovies.userId, watchedMovies.tmdbId] })

  // Append a viewing event if not already exists
  const existing = await db
    .select()
    .from(watchHistory)
    .where(
      and(
        eq(watchHistory.userId, userId),
        eq(watchHistory.tmdbId, tmdbId),
        eq(watchHistory.watchedAt, watchedAt)
      )
    )
    .limit(1)

  if (existing.length === 0) {
    await db.insert(watchHistory).values({
      userId,
      tmdbId,
      watchedAt,
    })
  }

  return 'imported'
}
