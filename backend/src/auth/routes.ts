import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { env } from '../env.js'
import { google, generateState, generateCodeVerifier, fetchGoogleUserInfo, type GoogleUserInfo } from './google.js'
import { cookieValue, createSession, deleteSession, parseCookie, readSession } from './session.js'

const STATE_COOKIE = 'google_oauth_state'
const VERIFIER_COOKIE = 'google_oauth_verifier'
const TEN_MIN = 10 * 60

function sessionCookieOpts() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60,
  }
}

/**
 * Derive first / last from Google's profile. Google sends given_name and
 * family_name separately when available, plus the combined `name`. We try
 * structured fields first, then fall back to splitting `name` on the first
 * space.
 */
function deriveNames(profile: GoogleUserInfo): { firstName: string | null; lastName: string | null; name: string | null } {
  const first = profile.given_name?.trim() || null
  const last = profile.family_name?.trim() || null
  if (first || last) {
    return { firstName: first, lastName: last, name: [first, last].filter(Boolean).join(' ') || profile.name?.trim() || null }
  }
  const combined = profile.name?.trim() || null
  if (!combined) return { firstName: null, lastName: null, name: null }
  const idx = combined.indexOf(' ')
  if (idx < 0) return { firstName: combined, lastName: null, name: combined }
  return {
    firstName: combined.slice(0, idx) || null,
    lastName: combined.slice(idx + 1).trim() || null,
    name: combined,
  }
}

const patchBody = z.object({
  first_name: z.string().min(1).max(120).nullable().optional(),
  last_name: z.string().min(1).max(120).nullable().optional(),
  avatar_url: z.string().url().max(1024).nullable().optional(),
})

export async function authRoutes(app: FastifyInstance) {
  // 1) Start OAuth — redirect to Google
  app.get('/api/auth/google', async (req, reply) => {
    const state = generateState()
    const codeVerifier = generateCodeVerifier()
    const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email'])

    const opts = { path: '/', httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: TEN_MIN }
    reply.setCookie(STATE_COOKIE, state, opts)
    reply.setCookie(VERIFIER_COOKIE, codeVerifier, opts)
    reply.redirect(url.toString())
  })

  // 2) OAuth callback
  app.get('/api/auth/google/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string }
    const cookieState = req.cookies[STATE_COOKIE]
    const codeVerifier = req.cookies[VERIFIER_COOKIE]

    if (!code || !state || !cookieState || !codeVerifier || state !== cookieState) {
      return reply.code(400).send({ error: 'invalid oauth state' })
    }

    const tokens = await google.validateAuthorizationCode(code, codeVerifier)
    const profile = await fetchGoogleUserInfo(tokens.accessToken())

    if (!profile.email_verified) {
      return reply.code(403).send({ error: 'email not verified by google' })
    }

    const derived = deriveNames(profile)

    const [existing] = await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1)
    let userId: string
    if (existing) {
      userId = existing.id
      // Refresh contact/display fields if they drifted. We only overwrite
      // first/last if the user hasn't edited them (still matches Google's
      // last-known value or is still null) — that way a custom profile
      // isn't reverted by every login.
      const userEditedNames = existing.firstName !== null && existing.firstName !== derived.firstName
      const update: Partial<typeof users.$inferInsert> = {}
      if (existing.email !== profile.email) update.email = profile.email
      if (!userEditedNames) {
        if (existing.firstName !== derived.firstName) update.firstName = derived.firstName
        if (existing.lastName !== derived.lastName) update.lastName = derived.lastName
        if (existing.name !== derived.name) update.name = derived.name
      }
      if (existing.avatarUrl !== (profile.picture ?? null) && !existing.avatarUrl) {
        update.avatarUrl = profile.picture ?? null
      }
      if (Object.keys(update).length > 0) {
        await db.update(users).set(update).where(eq(users.id, userId))
      }
    } else {
      const [created] = await db
        .insert(users)
        .values({
          googleSub: profile.sub,
          email: profile.email,
          name: derived.name,
          firstName: derived.firstName,
          lastName: derived.lastName,
          avatarUrl: profile.picture ?? null,
        })
        .returning({ id: users.id })
      userId = created!.id
    }

    const session = await createSession(userId)
    reply.clearCookie(STATE_COOKIE, { path: '/' })
    reply.clearCookie(VERIFIER_COOKIE, { path: '/' })
    reply.setCookie(env.SESSION_COOKIE_NAME, cookieValue(session.id), sessionCookieOpts())
    reply.redirect(env.FRONTEND_ORIGIN)
  })

  // 3) Logout
  app.post('/api/auth/logout', async (req, reply) => {
    const raw = req.cookies[env.SESSION_COOKIE_NAME]
    if (raw) {
      const id = parseCookie(raw)
      if (id) await deleteSession(id)
    }
    reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' })
    return { ok: true }
  })

  // 4) Whoami — read current user from session
  app.get('/api/auth/me', async (req, reply) => {
    const raw = req.cookies[env.SESSION_COOKIE_NAME]
    if (!raw) return reply.code(401).send({ error: 'unauthenticated' })
    const id = parseCookie(raw)
    if (!id) return reply.code(401).send({ error: 'invalid session' })
    const row = await readSession(id)
    if (!row) return reply.code(401).send({ error: 'session expired' })
    return {
      id: row.user.id,
      email: row.user.email,
      name: row.user.name,
      first_name: row.user.firstName,
      last_name: row.user.lastName,
      avatar_url: row.user.avatarUrl,
    }
  })

  // 5) Update profile — name + avatar
  app.patch('/api/auth/me', async (req, reply) => {
    const raw = req.cookies[env.SESSION_COOKIE_NAME]
    if (!raw) return reply.code(401).send({ error: 'unauthenticated' })
    const id = parseCookie(raw)
    if (!id) return reply.code(401).send({ error: 'invalid session' })
    const row = await readSession(id)
    if (!row) return reply.code(401).send({ error: 'session expired' })

    const body = patchBody.parse(req.body)
    if (body.first_name === undefined && body.last_name === undefined && body.avatar_url === undefined) {
      return reply.code(400).send({ error: 'nothing to update' })
    }

    const update: Partial<typeof users.$inferInsert> = {}
    if (body.first_name !== undefined) update.firstName = body.first_name ?? null
    if (body.last_name !== undefined) update.lastName = body.last_name ?? null
    if (body.avatar_url !== undefined) update.avatarUrl = body.avatar_url ?? null

    // Resync the combined `name` so denormalised join targets (e.g. public
    // lists' owner_name) stay current.
    const nextFirst = body.first_name !== undefined ? body.first_name : row.user.firstName
    const nextLast = body.last_name !== undefined ? body.last_name : row.user.lastName
    update.name = [nextFirst, nextLast].filter(Boolean).join(' ') || null

    const [updated] = await db
      .update(users)
      .set(update)
      .where(eq(users.id, row.user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      })

    return {
      id: updated!.id,
      email: updated!.email,
      name: updated!.name,
      first_name: updated!.firstName,
      last_name: updated!.lastName,
      avatar_url: updated!.avatarUrl,
    }
  })
}
