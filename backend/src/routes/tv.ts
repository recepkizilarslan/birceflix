import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { watchedMovies } from '../db/schema.js'
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

const watchedFilterEnum = z.enum(['all', 'unwatched', 'watched']).default('all')

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
  page: z.coerce.number().int().min(1).default(1),
  ui_language: uiLanguageSchema,
  /** Mirrors the movie discover endpoint — see routes/discover.ts for the
   *  full rationale on why this lives server-side. */
  watched_filter: watchedFilterEnum,
})

const WATCHED_PAGE_SIZE = 20

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
  // TV-specific date param names. `watched_filter` semantics are identical
  // to the movie endpoint: 'watched' sources from watched_movies, 'unwatched'
  // subtracts watched IDs from a TMDB page.
  app.get('/api/tv/discover', async (req) => {
    const q = discoverQuery.parse(req.query)

    // ------------- watched: skip TMDB, render from watched_movies -------------
    if (q.watched_filter === 'watched') {
      const userId = await app.requireAuth(req)
      const offset = (q.page - 1) * WATCHED_PAGE_SIZE

      const [items, totalRow] = await Promise.all([
        db
          .select()
          .from(watchedMovies)
          .where(and(eq(watchedMovies.userId, userId), eq(watchedMovies.mediaType, 'tv')))
          .orderBy(desc(watchedMovies.watchedAt))
          .limit(WATCHED_PAGE_SIZE)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int`.as('total') })
          .from(watchedMovies)
          .where(and(eq(watchedMovies.userId, userId), eq(watchedMovies.mediaType, 'tv'))),
      ])

      const total = totalRow[0]?.total ?? 0
      const totalPages = Math.max(1, Math.ceil(total / WATCHED_PAGE_SIZE))

      const ignored: string[] = []
      if (q.with_genres) ignored.push('with_genres')
      if (q.year_from != null || q.year_to != null) ignored.push('year')
      if (q.min_rating != null) ignored.push('min_rating')
      if (q.runtime_from != null || q.runtime_to != null) ignored.push('runtime')
      if (q.with_watch_providers) ignored.push('with_watch_providers')
      if (q.original_language) ignored.push('original_language')
      if (q.origin_country) ignored.push('origin_country')
      if (q.seasons_from != null || q.seasons_to != null) ignored.push('seasons')
      if (q.episodes_from != null || q.episodes_to != null) ignored.push('episodes')
      if (q.sort_by && q.sort_by !== 'popularity.desc') ignored.push('sort_by')

      return {
        page: q.page,
        total_pages: totalPages,
        total_results: total,
        // Pad to the TvShowBrief shape enrichTvBrief produces so the
        // frontend's TV-card components don't fork on the result source.
        results: items.map((r) => ({
          id: r.tmdbId,
          name: r.title,
          original_name: r.title,
          original_language: '',
          overview: '',
          poster_path: r.posterPath,
          backdrop_path: null,
          first_air_date: r.watchedAt.toISOString().slice(0, 10),
          vote_average: r.myRating ?? 0,
          vote_count: 0,
          genre_ids: [],
          number_of_seasons: null,
          number_of_episodes: null,
        })),
        filtered_out: 0,
        watched_filter: 'watched' as const,
        filters_ignored: ignored,
      }
    }

    // ------------- all / unwatched: TMDB then optional subtract -------------
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
    // `filtered_out` field tells the UI how many of the page survived
    // the filter, separate from TMDB's total_results which counts the
    // pre-filter universe.
    const usingCountFilter =
      q.seasons_from != null || q.seasons_to != null ||
      q.episodes_from != null || q.episodes_to != null

    let countFilteredOut = 0
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
      countFilteredOut = beforeFilter - results.length
    }

    if (q.watched_filter === 'unwatched') {
      const userId = await app.requireAuth(req)
      const watched = await db
        .select({ tmdbId: watchedMovies.tmdbId })
        .from(watchedMovies)
        .where(and(eq(watchedMovies.userId, userId), eq(watchedMovies.mediaType, 'tv')))
      const watchedIds = new Set(watched.map((w) => w.tmdbId))
      const before = results.length
      results = results.filter((r) => !watchedIds.has(r.id))
      return {
        ...data,
        results,
        filtered_out: countFilteredOut + (before - results.length),
        watched_filter: 'unwatched' as const,
      }
    }

    return { ...data, results, filtered_out: countFilteredOut, watched_filter: 'all' as const }
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
