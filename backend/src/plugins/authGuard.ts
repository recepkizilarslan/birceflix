import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { env } from '../env.js'
import { parseCookie, readSession } from '../auth/session.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest) => Promise<string>
  }
}

/**
 * Endpoints that must remain reachable without a session — the OAuth flow
 * itself, the "who am I" probe the frontend uses to decide whether to render
 * the sign-in screen, and the health check.
 */
function isPublicPath(url: string): boolean {
  // Strip query string for the comparison.
  const path = url.split('?')[0] ?? url
  if (path === '/api/health') return true
  if (path.startsWith('/api/auth/')) return true
  // The sign-in screen shows a marquee of streaming-service logos. These
  // are TMDB metadata endpoints with tiny, bounded response payloads — no
  // privacy concern in exposing them anonymously, and they don't burn
  // our TMDB budget the way an unbounded /discover would.
  if (path === '/api/providers' || path === '/api/tv/providers') return true
  // Anything outside /api/* isn't ours to gate (Caddy serves the SPA).
  return !path.startsWith('/api/')
}

async function authGuardPlugin(app: FastifyInstance) {
  app.decorateRequest('userId', undefined)

  // Pass 1: attach userId on every request if a valid session exists.
  app.addHook('preHandler', async (req) => {
    const raw = req.cookies[env.SESSION_COOKIE_NAME]
    if (!raw) return
    const id = parseCookie(raw)
    if (!id) return
    const row = await readSession(id)
    if (row) req.userId = row.user.id
  })

  // Pass 2: global gate. The app is single-user / invite-only, so every
  // /api/* route except the auth flow + health requires a session. This
  // also covers TMDB proxy routes (discover/search/movie/tv/...) — without
  // this we'd leak our TMDB key budget to anonymous traffic.
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (isPublicPath(req.url)) return
    if (!req.userId) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }
  })

  // Strict helper: route handlers can call this for the userId. With the
  // global gate above, req.userId is always set here — kept for the
  // type-narrowing convenience and as a defense-in-depth check.
  app.decorate('requireAuth', async (req: FastifyRequest) => {
    if (!req.userId) {
      const err = new Error('unauthenticated') as Error & { statusCode?: number }
      err.statusCode = 401
      throw err
    }
    return req.userId
  })
}

export default fp(authGuardPlugin, { name: 'authGuard' })
