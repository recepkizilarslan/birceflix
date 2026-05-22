import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { uiLanguageSchema } from '../lib/locale.js'

const querySchema = z.object({
  min_rating: z.coerce.number().optional(),
  min_votes: z.coerce.number().optional(),
  original_language: z.string().optional(),
  origin_country: z.string().optional(),
  with_genres: z.string().optional(),
  year_from: z.coerce.number().optional(),
  year_to: z.coerce.number().optional(),
  with_watch_providers: z.string().optional(),
  watch_region: z.string().optional(),
  runtime_from: z.coerce.number().optional(),
  runtime_to: z.coerce.number().optional(),
  sort_by: z.string().default('popularity.desc'),
  page: z.coerce.number().default(1),
  ui_language: uiLanguageSchema,
})

export async function discoverRoutes(app: FastifyInstance) {
  app.get('/api/discover', async (req) => {
    const q = querySchema.parse(req.query)

    // Only apply a vote_count floor when sorting by rating — otherwise
    // a handful of votes can dominate the chart.
    const defaultMinVotes = q.sort_by.startsWith('vote_average') ? '200' : undefined

    return tmdb('/discover/movie', {
      language: q.ui_language,
      sort_by: q.sort_by,
      page: String(q.page),
      'vote_average.gte': q.min_rating?.toString(),
      'vote_count.gte': q.min_votes?.toString() ?? defaultMinVotes,
      with_original_language: q.original_language,
      with_origin_country: q.origin_country,
      with_genres: q.with_genres,
      'primary_release_date.gte': q.year_from ? `${q.year_from}-01-01` : undefined,
      'primary_release_date.lte': q.year_to ? `${q.year_to}-12-31` : undefined,
      with_watch_providers: q.with_watch_providers,
      watch_region: q.watch_region,
      'with_runtime.gte': q.runtime_from?.toString(),
      'with_runtime.lte': q.runtime_to?.toString(),
      include_adult: 'false',
    })
  })
}
