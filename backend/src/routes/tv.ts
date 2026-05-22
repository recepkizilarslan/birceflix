import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { enrichTvBrief } from '../lib/tvCache.js'
import { uiLanguageSchema } from '../lib/locale.js'
import { env } from '../env.js'

const idParam = z.object({ id: z.coerce.number().int().positive() })
const seasonParam = z.object({
  id: z.coerce.number().int().positive(),
  season: z.coerce.number().int().min(0),
})
const searchQuery = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().default(1),
  ui_language: uiLanguageSchema,
})
const popularQuery = z.object({
  page: z.coerce.number().default(1),
  ui_language: uiLanguageSchema,
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
  // Post-filter (TMDB doesn't natively filter by total season/episode counts)
  seasons_from: z.coerce.number().int().min(0).optional(),
  seasons_to: z.coerce.number().int().min(0).optional(),
  episodes_from: z.coerce.number().int().min(0).optional(),
  episodes_to: z.coerce.number().int().min(0).optional(),
  sort_by: z.string().default('popularity.desc'),
  page: z.coerce.number().default(1),
  ui_language: uiLanguageSchema,
})

const providersQuery = z.object({
  region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
  ui_language: uiLanguageSchema,
})

const genresQuery = z.object({
  ui_language: uiLanguageSchema,
})

const detailQuery = z.object({
  ui_language: uiLanguageSchema,
})

// TV detail accepts an optional region so the response can slice out the
// region-specific watch providers, matching the movie detail endpoint.
// Default falls back to the env's DEFAULT_WATCH_REGION for ad-hoc API users.
const tvDetailQuery = z.object({
  region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
  ui_language: z.string().default('en-US'),
})

interface ProviderRow {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

export async function tvRoutes(app: FastifyInstance) {
  // TV show detail (with credits + external ids in case we want IMDB later).
  // `region` slices out per-region watch providers from the appended bag,
  // mirroring /api/movie/:id so the TV detail page can show provider chips.
  app.get('/api/tv/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const { region, ui_language } = tvDetailQuery.parse(req.query)
    const detail = await tmdb<{ id: number; [key: string]: unknown }>(`/tv/${id}`, {
      append_to_response: 'credits,external_ids,videos,watch/providers',
      language: ui_language,
    })
    const providers = (detail as { 'watch/providers'?: { results?: Record<string, unknown> } })['watch/providers']
    const watchProviders = providers?.results?.[region] ?? null
    return { ...detail, watch_providers: watchProviders }
  })

  // Single season — TMDB returns episode list with air_date, runtime, etc.
  app.get('/api/tv/:id/season/:season', async (req) => {
    const { id, season } = seasonParam.parse(req.params)
    const { ui_language } = detailQuery.parse(req.query)
    return tmdb(`/tv/${id}/season/${season}`, {
      language: ui_language,
    })
  })

  app.get('/api/tv/search', async (req) => {
    const { q, page, ui_language } = searchQuery.parse(req.query)
    const data = await tmdb<{ results: { id: number }[]; page: number; total_pages: number; total_results: number }>('/search/tv', {
      query: q,
      page: String(page),
      language: ui_language,
      include_adult: 'false',
    })
    return { ...data, results: await enrichTvBrief(data.results) }
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

    const data = await tmdb<{ results: { id: number }[]; page: number; total_pages: number; total_results: number }>('/discover/tv', {
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

    let results = await enrichTvBrief(data.results)

    // Post-filter on counts (TMDB has no native param for these). The
    // `filtered_total` field tells the UI how many of the page survived
    // the filter, separate from TMDB's total_results which counts the
    // pre-filter universe.
    const usingCountFilter =
      q.seasons_from != null || q.seasons_to != null ||
      q.episodes_from != null || q.episodes_to != null

    if (usingCountFilter) {
      const beforeFilter = results.length
      results = results.filter((r) => {
        const s = r.number_of_seasons ?? 0
        const e = r.number_of_episodes ?? 0
        if (q.seasons_from != null && s < q.seasons_from) return false
        if (q.seasons_to != null && s > q.seasons_to) return false
        if (q.episodes_from != null && e < q.episodes_from) return false
        if (q.episodes_to != null && e > q.episodes_to) return false
        return true
      })
      return { ...data, results, filtered_out: beforeFilter - results.length }
    }

    return { ...data, results, filtered_out: 0 }
  })

  // TV genre list — IDs differ from /genre/movie/list so the filter UI
  // needs a separate fetch.
  app.get('/api/tv/genres', async (req) => {
    const { ui_language } = genresQuery.parse(req.query)
    const data = await tmdb<{ genres: { id: number; name: string }[] }>('/genre/tv/list', {
      language: ui_language,
    })
    return data.genres
  })

  // TV watch providers per region (Netflix, Disney+, etc).
  app.get('/api/tv/providers', async (req) => {
    const { region, ui_language } = providersQuery.parse(req.query)
    const data = await tmdb<{ results: ProviderRow[] }>('/watch/providers/tv', {
      language: ui_language,
      watch_region: region,
    })
    return data.results
  })
}
