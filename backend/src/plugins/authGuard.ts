import type { FastifyInstance, FastifyRequest } from 'fastify'
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

async function authGuardPlugin(app: FastifyInstance) {
  app.decorateRequest('userId', undefined)

  // Best-effort: attach userId on every request if a valid session exists.
  app.addHook('preHandler', async (req) => {
    const raw = req.cookies[env.SESSION_COOKIE_NAME]
    if (!raw) return
    const id = parseCookie(raw)
    if (!id) return
    const row = await readSession(id)
    if (row) req.userId = row.user.id
  })

  // Strict: routes call this to enforce auth and get the userId
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
