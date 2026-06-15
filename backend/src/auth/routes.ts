import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { env } from '../env.js'
import { google, generateState, generateCodeVerifier, fetchGoogleUserInfo, type GoogleUserInfo } from './google.js'
import { cookieValue, createSession, deleteSession, parseCookie, readSession } from './session.js'
import { rlAuth } from '../lib/rateLimit.js'

const STATE_COOKIE = 'google_oauth_state'
const VERIFIER_COOKIE = 'google_oauth_verifier'
const NEXT_COOKIE = 'google_oauth_next'
const TEN_MIN = 10 * 60

/**
 * Restrict the OAuth `next` redirect target to same-origin pathnames so
 * we can't be coerced into a generic open-redirect. Reject empty values,
 * absolute URLs, protocol-relative URLs (`//evil.example/...`), and the
 * `\` variants browsers normalise into the same thing.
 */
function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null
  // Anything that smells like a scheme bail out as a final guard.
  if (/^\/[a-z][a-z0-9+\-.]*:/i.test(raw)) return null
  return raw
}

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
  // lgtm [js/missing-rate-limiting]
  app.get('/api/auth/google', rlAuth, async (req, reply) => {
    const state = generateState()
    const codeVerifier = generateCodeVerifier()
    const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email'])

    const opts = { path: '/', httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: TEN_MIN }
    reply.setCookie(STATE_COOKIE, state, opts)
    reply.setCookie(VERIFIER_COOKIE, codeVerifier, opts)
    // Stash the post-login destination across the Google round-trip.
    // Frontend already sanitises before it gets here, but we re-validate
    // both on the way in and out so a hand-crafted call can't smuggle a
    // hostile redirect through this hop.
    const nextRaw = (req.query as { next?: string }).next
    const next = safeNextPath(nextRaw ?? null)
    if (next) reply.setCookie(NEXT_COOKIE, next, opts)
    reply.redirect(url.toString())
  })

  // 2) OAuth callback
  // lgtm [js/missing-rate-limiting]
  app.get('/api/auth/google/callback', rlAuth, async (req, reply) => {
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

    // Match the Google account to an existing row. First by the stable
    // google_sub; failing that, by verified email — that adopts any legacy
    // row created under this address (e.g. a pre-Google-only password
    // account) and attaches the google_sub, so the user keeps their data
    // instead of colliding with the UNIQUE(email) constraint on insert.
    // Safe because Google has already verified ownership of the address.
    let existing = (await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1))[0]
    if (!existing) {
      const [byEmail] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1)
      if (byEmail && !byEmail.googleSub) {
        await db.update(users).set({ googleSub: profile.sub }).where(eq(users.id, byEmail.id))
        existing = { ...byEmail, googleSub: profile.sub }
      }
    }
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

    const next = safeNextPath(req.cookies[NEXT_COOKIE] ?? null)
    reply.clearCookie(NEXT_COOKIE, { path: '/' })
    reply.redirect(next ? env.FRONTEND_ORIGIN + next : env.FRONTEND_ORIGIN)
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
}
