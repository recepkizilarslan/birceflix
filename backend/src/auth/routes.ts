import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { env } from '../env.js'
import { google, generateState, generateCodeVerifier, fetchGoogleUserInfo, type GoogleUserInfo } from './google.js'
import { cookieValue, createSession, deleteSession, parseCookie, readSession } from './session.js'
import { hashPassword, verifyPassword } from './password.js'

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

  // 4) Email + password register
  const registerBody = z.object({
    email: z.string().email().max(200).transform((s) => s.trim().toLowerCase()),
    password: z.string().min(8).max(200),
    name: z.string().trim().max(120).optional(),
  })
  app.post('/api/auth/register', async (req, reply) => {
    const parsed = registerBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', details: parsed.error.flatten() })
    }
    const { email, password, name } = parsed.data

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing) {
      // Two cases: pure-Google account (we can link a password to it) or
      // already has a password (registered before). Linking is the friendly
      // path — the user picks the same email they signed up with on
      // Google and we just attach a password. We reject if there's already
      // a password, so brute-force attempts can't tell registered emails
      // apart from unregistered ones.
      if (existing.passwordHash) {
        return reply.code(409).send({ error: 'email_taken' })
      }
      const hashed = await hashPassword(password)
      const update: Partial<typeof users.$inferInsert> = { passwordHash: hashed }
      if (name && !existing.name) {
        update.name = name
        const idx = name.indexOf(' ')
        update.firstName = idx < 0 ? name : name.slice(0, idx)
        update.lastName = idx < 0 ? null : name.slice(idx + 1).trim() || null
      }
      await db.update(users).set(update).where(eq(users.id, existing.id))
      const session = await createSession(existing.id)
      reply.setCookie(env.SESSION_COOKIE_NAME, cookieValue(session.id), sessionCookieOpts())
      return { ok: true, linked: true }
    }

    // New user
    const hashed = await hashPassword(password)
    const first = name ? name.slice(0, name.indexOf(' ') >= 0 ? name.indexOf(' ') : name.length) : null
    const last = name && name.indexOf(' ') >= 0 ? name.slice(name.indexOf(' ') + 1).trim() || null : null
    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash: hashed,
        name: name ?? null,
        firstName: first,
        lastName: last,
      })
      .returning({ id: users.id })
    const session = await createSession(created!.id)
    reply.setCookie(env.SESSION_COOKIE_NAME, cookieValue(session.id), sessionCookieOpts())
    return { ok: true }
  })

  // 5) Email + password login
  const loginBody = z.object({
    email: z.string().email().max(200).transform((s) => s.trim().toLowerCase()),
    password: z.string().min(1).max(200),
  })
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input' })
    }
    const { email, password } = parsed.data
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    // Same response for "no such user" and "wrong password" so we don't
    // leak which emails exist in the system.
    if (!row || !row.passwordHash) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }
    const ok = await verifyPassword(password, row.passwordHash)
    if (!ok) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }
    const session = await createSession(row.id)
    reply.setCookie(env.SESSION_COOKIE_NAME, cookieValue(session.id), sessionCookieOpts())
    return { ok: true }
  })

  // 6) Whoami — read current user from session
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
}
