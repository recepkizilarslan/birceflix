import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import sensible from '@fastify/sensible'
import rateLimit from '@fastify/rate-limit'

import { env } from './env.js'
import authGuard from './plugins/authGuard.js'
import { authRoutes } from './auth/routes.js'
import { discoverRoutes } from './routes/discover.js'
import { searchRoutes } from './routes/search.js'
import { movieRoutes } from './routes/movie.js'
import { metaRoutes } from './routes/meta.js'
import { watchedRoutes } from './routes/watched.js'
import { watchlistRoutes } from './routes/watchlist.js'
import { historyRoutes } from './routes/history.js'
import { statsRoutes } from './routes/stats.js'
import { importRoutes } from './routes/import.js'
import { integrationsRoutes } from './routes/integrations.js'
import { tvRoutes } from './routes/tv.js'
import { watchedEpisodeRoutes } from './routes/watchedEpisodes.js'
import { listsRoutes } from './routes/lists.js'
import { webhookRoutes } from './routes/webhooks.js'
import { calendarRoutes } from './routes/calendar.js'

async function build() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true,
    trustProxy: true,
  })

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(sensible)
  await app.register(cookie, { secret: env.SESSION_SECRET })
  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? env.FRONTEND_ORIGIN : true,
    credentials: true,
  })
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  })
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  })

  await app.register(authGuard)

  // Routes
  await app.register(authRoutes)
  await app.register(discoverRoutes)
  await app.register(searchRoutes)
  await app.register(movieRoutes)
  await app.register(metaRoutes)
  await app.register(watchedRoutes)
  await app.register(watchlistRoutes)
  await app.register(historyRoutes)
  await app.register(statsRoutes)
  await app.register(importRoutes)
  await app.register(integrationsRoutes)
  await app.register(tvRoutes)
  await app.register(watchedEpisodeRoutes)
  await app.register(listsRoutes)
  await app.register(webhookRoutes)
  await app.register(calendarRoutes)

  app.get('/api/health', async () => ({ ok: true, env: env.NODE_ENV }))

  return app
}

async function main() {
  const app = await build()
  try {
    await app.listen({ host: env.HOST, port: env.PORT })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
