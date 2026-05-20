import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import sensible from '@fastify/sensible'
import rateLimit from '@fastify/rate-limit'

import { env } from './env.js'
import authGuard from './plugins/authGuard.js'
import services from './plugins/services.js'
import { authRoutes } from './auth/routes.js'
import { discoverRoutes } from './routes/discover.js'
import { searchRoutes } from './routes/search.js'
import { movieRoutes } from './routes/movie.js'
import { metaRoutes } from './routes/meta.js'
import { watchedRoutes } from './routes/watched.js'
import { watchlistRoutes } from './routes/watchlist.js'
import { historyRoutes } from './routes/history.js'
import { importRoutes } from './routes/import.js'
import { integrationsRoutes } from './routes/integrations.js'
import { tvRoutes } from './routes/tv.js'
import { watchedEpisodeRoutes } from './routes/watchedEpisodes.js'
import { listsRoutes } from './routes/lists.js'
import { savedFiltersRoutes } from './routes/savedFilters.js'
import { webhookRoutes } from './routes/webhooks.js'
import { calendarRoutes } from './routes/calendar.js'
import { exportRoutes } from './routes/export.js'
import { topRoutes } from './routes/top.js'
import { startTopRefresh } from './lib/topCache.js'
import { purgeExpired } from './auth/session.js'

async function build() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true,
    trustProxy: 1,
  })

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(sensible)
  await app.register(cookie, { secret: env.SESSION_SECRET })
  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
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
  await app.register(services)

  // Routes
  await app.register(authRoutes)
  await app.register(discoverRoutes)
  await app.register(searchRoutes)
  await app.register(movieRoutes)
  await app.register(metaRoutes)
  await app.register(watchedRoutes)
  await app.register(watchlistRoutes)
  await app.register(historyRoutes)
  await app.register(importRoutes)
  await app.register(integrationsRoutes)
  await app.register(tvRoutes)
  await app.register(watchedEpisodeRoutes)
  await app.register(listsRoutes)
  await app.register(savedFiltersRoutes)
  await app.register(webhookRoutes)
  await app.register(calendarRoutes)
  await app.register(exportRoutes)
  await app.register(topRoutes)

  app.get('/api/health', async () => ({ ok: true, env: env.NODE_ENV }))

  return app
}

async function main() {
  const app = await build()
  // Warm the top-rated snapshots (movie + TV, default region) before
  // accepting traffic so the first /api/top request is hot. Failures here
  // are swallowed inside the cache module (logged + retried on demand) so
  // a transient TMDB hiccup never blocks boot.
  await startTopRefresh(app.log)
  try {
    await app.listen({ host: env.HOST, port: env.PORT })

    // Purge expired sessions on boot, and then every 24 hours. unref() so
    // the timer doesn't hold the event loop open during graceful shutdown
    // or in test runners.
    purgeExpired().catch((err) => app.log.error(err, 'Failed to purge expired sessions on boot'))
    setInterval(() => {
      purgeExpired().catch((err) => app.log.error(err, 'Failed to purge expired sessions'))
    }, 24 * 60 * 60 * 1000).unref?.()
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
