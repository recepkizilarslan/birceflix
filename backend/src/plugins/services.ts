import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { db } from '../db/client.js'
import { WatchedService } from '../services/watched.service.js'
import { WatchlistService } from '../services/watchlist.service.js'

declare module 'fastify' {
  interface FastifyInstance {
    services: {
      watched: WatchedService
      watchlist: WatchlistService
    }
  }
}

async function servicesPlugin(app: FastifyInstance) {
  // Allow injecting custom db instance via app config for testing
  const targetDb = (app as any).config?.db || db

  const watched = new WatchedService(targetDb)
  const watchlist = new WatchlistService(targetDb)

  app.decorate('services', {
    watched,
    watchlist,
  })
}

export default fp(servicesPlugin, { name: 'services' })
