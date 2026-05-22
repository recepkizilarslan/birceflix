import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { watchedMovies } from '../db/schema.js'
import { tmdb } from '../lib/tmdb.js'

const watchedFilterEnum = z.enum(['all', 'unwatched', 'watched']).default('all')

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
  page: z.coerce.number().int().min(1).default(1),
  ui_language: z.string().default('en-US'),
  /** Client-side filter against the user's watched set. Server-side now
   *  because intersecting TMDB results with the watched table in the
   *  browser broke pagination (a page would visibly shrink) and made
   *  the "watched only" mode practically useless (TMDB's popularity
   *  ordering rarely overlaps with a single user's watched list). */
  watched_filter: watchedFilterEnum,
})

/** TMDB returns 20 items per page; mirror that in watched-mode pagination so
 *  the UI's page-stepper behaves consistently across modes. */
const WATCHED_PAGE_SIZE = 20

/** Filters that the watched-mode path can't honor because `watched_movies`
 *  doesn't denormalise enough TMDB metadata. Reported back in the response
 *  so the UI can hint at why these chips appear ineffective. */
type IgnoredFilter =
  | 'with_genres'
  | 'year_from'
  | 'year_to'
  | 'min_rating'
  | 'min_votes'
  | 'runtime_from'
  | 'runtime_to'
  | 'with_watch_providers'
  | 'original_language'
  | 'origin_country'
  | 'sort_by'

function collectIgnored(q: z.infer<typeof querySchema>): IgnoredFilter[] {
  const ignored: IgnoredFilter[] = []
  if (q.with_genres) ignored.push('with_genres')
  if (q.year_from != null) ignored.push('year_from')
  if (q.year_to != null) ignored.push('year_to')
  if (q.min_rating != null) ignored.push('min_rating')
  if (q.min_votes != null) ignored.push('min_votes')
  if (q.runtime_from != null) ignored.push('runtime_from')
  if (q.runtime_to != null) ignored.push('runtime_to')
  if (q.with_watch_providers) ignored.push('with_watch_providers')
  if (q.original_language) ignored.push('original_language')
  if (q.origin_country) ignored.push('origin_country')
  if (q.sort_by && q.sort_by !== 'popularity.desc') ignored.push('sort_by')
  return ignored
}

export async function discoverRoutes(app: FastifyInstance) {
  app.get('/api/discover', async (req) => {
    const q = querySchema.parse(req.query)

    // --------------------- watched: skip TMDB entirely --------------------
    // We render the user's own watched_movies as the source. Filters that
    // depend on TMDB metadata we don't store (genre, runtime, ...) are
    // listed in `filters_ignored` so the UI can dim them.
    if (q.watched_filter === 'watched') {
      const userId = await app.requireAuth(req)
      const offset = (q.page - 1) * WATCHED_PAGE_SIZE

      const [items, totalRow] = await Promise.all([
        db
          .select()
          .from(watchedMovies)
          .where(and(eq(watchedMovies.userId, userId), eq(watchedMovies.mediaType, 'movie')))
          .orderBy(desc(watchedMovies.watchedAt))
          .limit(WATCHED_PAGE_SIZE)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int`.as('total') })
          .from(watchedMovies)
          .where(and(eq(watchedMovies.userId, userId), eq(watchedMovies.mediaType, 'movie'))),
      ])

      const total = totalRow[0]?.total ?? 0
      const totalPages = Math.max(1, Math.ceil(total / WATCHED_PAGE_SIZE))

      return {
        page: q.page,
        total_pages: totalPages,
        total_results: total,
        // Shape mirrors TMDB's `results` so the frontend's card components
        // don't need a separate code path. Missing TMDB-only fields (genre
        // IDs, vote counts, etc.) are stubbed; the UI uses them for display
        // only here, never for filtering.
        results: items.map((r) => ({
          id: r.tmdbId,
          title: r.title,
          original_title: r.title,
          original_language: '',
          overview: '',
          poster_path: r.posterPath,
          backdrop_path: null,
          release_date: r.watchedAt.toISOString().slice(0, 10),
          vote_average: r.myRating ?? 0,
          vote_count: 0,
          genre_ids: [],
        })),
        watched_filter: 'watched' as const,
        filters_ignored: collectIgnored(q),
      }
    }

    // --------------------- all / unwatched: hit TMDB ---------------------
    const defaultMinVotes = q.sort_by.startsWith('vote_average') ? '200' : undefined

    const data = await tmdb<{
      results: { id: number; [k: string]: unknown }[]
      page: number
      total_pages: number
      total_results: number
    }>('/discover/movie', {
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

    if (q.watched_filter === 'all') {
      return { ...data, watched_filter: 'all' as const, filtered_out: 0 }
    }

    // unwatched: subtract the user's watched set from this page's results.
    // We deliberately don't chase additional TMDB pages to refill the slot —
    // doing so would require stateful cross-page bookkeeping (skipped IDs)
    // and TMDB has a 500-page hard cap anyway. The UI surfaces `filtered_out`
    // so the user understands why a page can look shorter.
    const userId = await app.requireAuth(req)
    const watched = await db
      .select({ tmdbId: watchedMovies.tmdbId })
      .from(watchedMovies)
      .where(and(eq(watchedMovies.userId, userId), eq(watchedMovies.mediaType, 'movie')))
    const watchedIds = new Set(watched.map((w) => w.tmdbId))

    const filtered = data.results.filter((r) => !watchedIds.has(r.id))

    // Adjust total_results / total_pages so the UI's "X sonuç • sayfa Y / Z"
    // line reflects the unwatched universe, not TMDB's pre-filter one. We
    // can't know precisely how many of TMDB's `total_results` overlap with
    // the user's watched set without an exact join — TMDB doesn't expose
    // that. Conservative estimate: subtract the user's total watched count
    // for this media type. This UNDERSHOOTS when many of the user's
    // watched items wouldn't match the active filter (e.g. user has 500
    // watched movies but only 5 are Korean drama for a "Korean drama"
    // filter — we still subtract 500, so the displayed total is lower
    // than reality). That's the safer direction to err: the user might
    // see "still 9500 to discover" instead of the true 9995, never the
    // reverse ("0 left" when actually plenty remain).
    const totalResults = Math.max(0, data.total_results - watched.length)
    // TMDB always paginates at 20/page; using a literal here rather than
    // data.results.length avoids divide-by-something-wrong on the last page.
    const TMDB_PAGE_SIZE = 20
    const totalPages = Math.max(
      1,
      Math.min(data.total_pages, Math.ceil(totalResults / TMDB_PAGE_SIZE)),
    )

    return {
      ...data,
      results: filtered,
      total_results: totalResults,
      total_pages: totalPages,
      watched_filter: 'unwatched' as const,
      filtered_out: data.results.length - filtered.length,
      /** TMDB's pre-filter count, kept around so the UI can show
       *  "X of Y total, Y-X already watched" if it wants. */
      total_results_unfiltered: data.total_results,
    }
  })
}
