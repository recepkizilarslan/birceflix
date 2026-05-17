import type { FastifyInstance } from 'fastify'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { watchedMovies, watchHistory } from '../db/schema.js'

interface StatsResponse {
  total_watched: number
  total_viewings: number
  /** Index 0 = rating 1, index 9 = rating 10. */
  rating_distribution: number[]
  /** Viewings in the last 12 calendar months, oldest → newest. */
  viewings_by_month: { month: string; count: number }[]
  /** Viewings grouped by calendar year, desc. */
  viewings_by_year: { year: number; count: number }[]
  /** Top 10 locations by viewing count. */
  top_locations: { location: string; count: number }[]
  /** First-time-marked-watched count per calendar year, desc. */
  watched_by_year: { year: number; count: number }[]
}

export async function statsRoutes(app: FastifyInstance) {
  app.get('/api/stats', async (req): Promise<StatsResponse> => {
    const userId = await app.requireAuth(req)

    // 1) Total watched (one row per movie in watched_movies)
    const totalWatchedRows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(watchedMovies)
      .where(eq(watchedMovies.userId, userId))
    const total_watched = totalWatchedRows[0]?.n ?? 0

    // 2) Total viewings (one row per viewing event in watch_history)
    const totalViewingsRows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(watchHistory)
      .where(eq(watchHistory.userId, userId))
    const total_viewings = totalViewingsRows[0]?.n ?? 0

    // 3) Rating distribution. Prefer history ratings; fall back to watched_movies
    //    overall rating for movies with no rated viewings.
    const watchedRatings = await db
      .select({ rating: watchedMovies.myRating, n: sql<number>`count(*)::int` })
      .from(watchedMovies)
      .where(and(eq(watchedMovies.userId, userId), isNotNull(watchedMovies.myRating)))
      .groupBy(watchedMovies.myRating)

    const rating_distribution: number[] = Array(10).fill(0)
    for (const r of watchedRatings) {
      if (r.rating != null && r.rating >= 1 && r.rating <= 10) {
        rating_distribution[r.rating - 1] = r.n
      }
    }

    // 4) Viewings by month — last 12 calendar months, oldest → newest
    const byMonth = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${watchHistory.watchedAt}), 'YYYY-MM')`,
        n: sql<number>`count(*)::int`,
      })
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.userId, userId),
          sql`${watchHistory.watchedAt} >= now() - interval '12 months'`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${watchHistory.watchedAt})`)
      .orderBy(sql`date_trunc('month', ${watchHistory.watchedAt}) asc`)
    const viewings_by_month = byMonth.map((r) => ({ month: r.month, count: r.n }))

    // 5) Viewings by year (full history, desc)
    const byYearViewings = await db
      .select({
        year: sql<number>`extract(year from ${watchHistory.watchedAt})::int`,
        n: sql<number>`count(*)::int`,
      })
      .from(watchHistory)
      .where(eq(watchHistory.userId, userId))
      .groupBy(sql`extract(year from ${watchHistory.watchedAt})`)
      .orderBy(sql`extract(year from ${watchHistory.watchedAt}) desc`)
    const viewings_by_year = byYearViewings.map((r) => ({ year: r.year, count: r.n }))

    // 6) Top locations (top 10)
    const locs = await db
      .select({ location: watchHistory.location, n: sql<number>`count(*)::int` })
      .from(watchHistory)
      .where(and(eq(watchHistory.userId, userId), isNotNull(watchHistory.location)))
      .groupBy(watchHistory.location)
      .orderBy(sql`count(*) desc`)
      .limit(10)
    const top_locations = locs
      .filter((r): r is { location: string; n: number } => r.location != null)
      .map((r) => ({ location: r.location, count: r.n }))

    // 7) "watched by year" — based on the watched_movies row's first-watched timestamp
    const wby = await db
      .select({
        year: sql<number>`extract(year from ${watchedMovies.watchedAt})::int`,
        n: sql<number>`count(*)::int`,
      })
      .from(watchedMovies)
      .where(eq(watchedMovies.userId, userId))
      .groupBy(sql`extract(year from ${watchedMovies.watchedAt})`)
      .orderBy(sql`extract(year from ${watchedMovies.watchedAt}) desc`)
    const watched_by_year = wby.map((r) => ({ year: r.year, count: r.n }))

    return {
      total_watched,
      total_viewings,
      rating_distribution,
      viewings_by_month,
      viewings_by_year,
      top_locations,
      watched_by_year,
    }
  })
}
