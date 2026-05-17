import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { omdbByImdbId } from '../lib/omdb.js'
import { env } from '../env.js'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })
const querySchema = z.object({
  region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
  ui_language: z.string().default('en-US'),
})

interface TmdbDetail {
  id: number
  imdb_id?: string
  runtime?: number
  [key: string]: unknown
}

export async function movieRoutes(app: FastifyInstance) {
  app.get('/api/movie/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params)
    const { region, ui_language } = querySchema.parse(req.query)

    const detail = await tmdb<TmdbDetail>(`/movie/${id}`, {
      language: ui_language,
      append_to_response: 'credits,videos,reviews,watch/providers',
    })

    // OMDb enrichment — only on detail page (1000/day budget)
    let omdb: Record<string, unknown> | null = null
    let awards: string | null = null
    let imdbRating: string | null = null
    if (detail.imdb_id) {
      omdb = await omdbByImdbId(detail.imdb_id).catch(() => null)
      if (omdb) {
        const a = omdb.Awards
        awards = typeof a === 'string' && a !== 'N/A' ? a : null
        const r = omdb.imdbRating
        imdbRating = typeof r === 'string' && r !== 'N/A' ? r : null
      }
    }

    // Pull region-specific providers out of the bag if present
    const providers = (detail as { 'watch/providers'?: { results?: Record<string, unknown> } })['watch/providers']
    const watchProviders = providers?.results?.[region] ?? null

    void reply
    return {
      ...detail,
      omdb,
      awards,
      imdb_rating: imdbRating,
      watch_providers: watchProviders,
    }
  })
}
