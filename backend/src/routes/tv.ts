import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { env } from '../env.js'

const idParam = z.object({ id: z.coerce.number().int().positive() })
const seasonParam = z.object({
  id: z.coerce.number().int().positive(),
  season: z.coerce.number().int().min(0),
})
const searchQuery = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().default(1),
  ui_language: z.string().default('en-US'),
})
const popularQuery = z.object({
  page: z.coerce.number().default(1),
  ui_language: z.string().default('en-US'),
})

// Same shape as movie discover but emitted to /discover/tv with TV-specific
// date param names. Runtime is per-episode for TV, which is what the user
// expects when filtering "show me 25-min comedies".
const discoverQuery = z.object({
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
  ui_language: z.string().default('en-US'),
})

const providersQuery = z.object({
  region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
})

interface ProviderRow {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

export async function tvRoutes(app: FastifyInstance) {
  // TV show detail (with credits + external ids in case we want IMDB later)
  app.get('/api/tv/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    return tmdb(`/tv/${id}`, {
      append_to_response: 'credits,external_ids,videos',
      language: 'en-US',
    })
  })

  // Single season — TMDB returns episode list with air_date, runtime, etc.
  app.get('/api/tv/:id/season/:season', async (req) => {
    const { id, season } = seasonParam.parse(req.params)
    return tmdb(`/tv/${id}/season/${season}`, {
      language: 'en-US',
    })
  })

  app.get('/api/tv/search', async (req) => {
    const { q, page, ui_language } = searchQuery.parse(req.query)
    return tmdb('/search/tv', {
      query: q,
      page: String(page),
      language: ui_language,
      include_adult: 'false',
    })
  })

  // Popular TV shows — kept around as a no-filter fallback the discover page
  // never reaches in practice, but available for ad-hoc API consumers.
  app.get('/api/tv/popular', async (req) => {
    const { page, ui_language } = popularQuery.parse(req.query)
    return tmdb('/tv/popular', {
      page: String(page),
      language: ui_language,
    })
  })

  // Filtered TV discover — mirrors /api/discover but uses /discover/tv and
  // TV-specific date param names.
  app.get('/api/tv/discover', async (req) => {
    const q = discoverQuery.parse(req.query)
    const defaultMinVotes = q.sort_by.startsWith('vote_average') ? '50' : undefined

    return tmdb('/discover/tv', {
      language: q.ui_language,
      sort_by: q.sort_by,
      page: String(q.page),
      'vote_average.gte': q.min_rating?.toString(),
      'vote_count.gte': q.min_votes?.toString() ?? defaultMinVotes,
      with_original_language: q.original_language,
      with_origin_country: q.origin_country,
      with_genres: q.with_genres,
      'first_air_date.gte': q.year_from ? `${q.year_from}-01-01` : undefined,
      'first_air_date.lte': q.year_to ? `${q.year_to}-12-31` : undefined,
      with_watch_providers: q.with_watch_providers,
      watch_region: q.watch_region,
      'with_runtime.gte': q.runtime_from?.toString(),
      'with_runtime.lte': q.runtime_to?.toString(),
      include_adult: 'false',
    })
  })

  // TV genre list — IDs differ from /genre/movie/list so the filter UI
  // needs a separate fetch.
  app.get('/api/tv/genres', async () => {
    const data = await tmdb<{ genres: { id: number; name: string }[] }>('/genre/tv/list', {
      language: 'en-US',
    })
    return data.genres
  })

  // TV watch providers per region (Netflix, Disney+, etc).
  app.get('/api/tv/providers', async (req) => {
    const { region } = providersQuery.parse(req.query)
    const data = await tmdb<{ results: ProviderRow[] }>('/watch/providers/tv', {
      language: 'en-US',
      watch_region: region,
    })
    return data.results
  })
}
