import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { env } from '../env.js'
import { google, generateState, generateCodeVerifier, fetchGoogleUserInfo } from './google.js'
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

    // Upsert user by google_sub
    const [existing] = await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1)
    let userId: string
    if (existing) {
      userId = existing.id
      // refresh display fields if changed
      if (existing.email !== profile.email || existing.name !== (profile.name ?? null) || existing.avatarUrl !== (profile.picture ?? null)) {
        await db.update(users).set({ email: profile.email, name: profile.name ?? null, avatarUrl: profile.picture ?? null }).where(eq(users.id, userId))
      }
    } else {
      const [created] = await db
        .insert(users)
        .values({ googleSub: profile.sub, email: profile.email, name: profile.name ?? null, avatarUrl: profile.picture ?? null })
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
      avatar_url: row.user.avatarUrl,
    }
  })
}
