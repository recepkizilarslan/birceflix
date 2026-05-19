import type { FastifyInstance } from 'fastify'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  listItems,
  lists,
  users,
  watchedEpisodes,
  watchedMovies,
  watchHistory,
  watchlist,
} from '../db/schema.js'
import { rlRead } from '../lib/rateLimit.js'

/** Wrap a field in quotes if it contains a comma, quote, or newline; double internal quotes. */
function csvField(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvField).join(',')
}

/** Our 1..10 scale → Letterboxd's 0.5..5.0 half-stars. */
function ratingToStars(r: number | null): string {
  if (r == null) return ''
  const stars = r / 2
  // Letterboxd's import treats "3" and "3.0" the same; emit one decimal for clarity.
  return stars.toFixed(1)
}

function isoDateOnly(d: Date): string {
  // YYYY-MM-DD in UTC (Letterboxd accepts any ISO date)
  return d.toISOString().slice(0, 10)
}

export async function exportRoutes(app: FastifyInstance) {
  /**
   * Full JSON dump of everything the backend stores for the current user.
   * Includes all denormalised data so the file is self-contained.
   * Excludes secrets (Trakt tokens, webhook tokens) by design — a backup
   * should never carry credentials.
   */
  app.get('/api/export/json', rlRead, async (req, reply) => {
    const userId = await app.requireAuth(req)

    const [profile] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar_url: users.avatarUrl,
        created_at: users.createdAt,
        trakt_connected: users.traktAccessToken,
        trakt_last_sync_at: users.traktLastSyncAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const [wm, wh, wl, we, ls] = await Promise.all([
      db.select().from(watchedMovies).where(eq(watchedMovies.userId, userId)).orderBy(desc(watchedMovies.watchedAt)),
      db.select().from(watchHistory).where(eq(watchHistory.userId, userId)).orderBy(desc(watchHistory.watchedAt)),
      db.select().from(watchlist).where(eq(watchlist.userId, userId)).orderBy(desc(watchlist.addedAt)),
      db.select().from(watchedEpisodes).where(eq(watchedEpisodes.userId, userId)).orderBy(desc(watchedEpisodes.watchedAt)),
      db.select().from(lists).where(eq(lists.userId, userId)).orderBy(desc(lists.updatedAt)),
    ])

    // Hydrate list items for each list.
    const listsWithItems = await Promise.all(
      ls.map(async (l) => {
        const items = await db
          .select()
          .from(listItems)
          .where(eq(listItems.listId, l.id))
          .orderBy(asc(listItems.position), asc(listItems.addedAt))
        return {
          id: l.id,
          name: l.name,
          description: l.description,
          is_public: l.isPublic,
          public_slug: l.publicSlug,
          created_at: l.createdAt.toISOString(),
          updated_at: l.updatedAt.toISOString(),
          items: items.map((i) => ({
            tmdb_id: i.tmdbId,
            title: i.title,
            poster_path: i.posterPath,
            position: i.position,
            added_at: i.addedAt.toISOString(),
          })),
        }
      }),
    )

    const payload = {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      profile: profile && {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at.toISOString(),
        trakt_connected: !!profile.trakt_connected,
        trakt_last_sync_at: profile.trakt_last_sync_at?.toISOString() ?? null,
      },
      watched_movies: wm.map((r) => ({
        tmdb_id: r.tmdbId,
        imdb_id: r.imdbId,
        title: r.title,
        poster_path: r.posterPath,
        watched_at: r.watchedAt.toISOString(),
        my_rating: r.myRating,
        notes: r.notes,
      })),
      watch_history: wh.map((r) => ({
        id: r.id,
        tmdb_id: r.tmdbId,
        watched_at: r.watchedAt.toISOString(),
        my_rating: r.myRating,
        notes: r.notes,
      })),
      watchlist: wl.map((r) => ({
        tmdb_id: r.tmdbId,
        title: r.title,
        poster_path: r.posterPath,
        priority: r.priority,
        added_at: r.addedAt.toISOString(),
      })),
      watched_episodes: we.map((r) => ({
        show_id: r.showId,
        show_name: r.showName,
        show_poster_path: r.showPosterPath,
        season_number: r.seasonNumber,
        episode_number: r.episodeNumber,
        episode_name: r.episodeName,
        watched_at: r.watchedAt.toISOString(),
        my_rating: r.myRating,
        notes: r.notes,
      })),
      lists: listsWithItems,
    }

    const filename = `birceflix-export-${isoDateOnly(new Date())}.json`
    reply
      .header('content-type', 'application/json; charset=utf-8')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .send(JSON.stringify(payload, null, 2))
  })

  /**
   * Letterboxd-compatible diary CSV.
   *
   * Columns (Letterboxd's diary import expects):
   *   Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date
   *
   * Strategy:
   *   - Every watch_history row → one diary entry with its actual date.
   *   - For watched_movies that have NO matching history row, fall back to
   *     emitting one undated entry (Letterboxd will still import it as a
   *     diary-less watch).
   */
  app.get('/api/export/letterboxd-diary.csv', rlRead, async (req, reply) => {
    const userId = await app.requireAuth(req)

    const [wmRows, whRows] = await Promise.all([
      db.select().from(watchedMovies).where(eq(watchedMovies.userId, userId)),
      db.select().from(watchHistory).where(eq(watchHistory.userId, userId)).orderBy(asc(watchHistory.watchedAt)),
    ])

    // Build a quick map of overall rating + title per movie so history rows
    // (which don't carry the title) can resolve them.
    const movieMeta = new Map<number, { title: string; rating: number | null }>()
    for (const r of wmRows) {
      movieMeta.set(r.tmdbId, { title: r.title, rating: r.myRating })
    }

    // Track which movies were already emitted via history so we can pick up
    // any history-less watched_movies at the end.
    const seenViaHistory = new Set<number>()
    const lines: string[] = []
    lines.push('Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date')

    for (const h of whRows) {
      const meta = movieMeta.get(h.tmdbId)
      const date = isoDateOnly(h.watchedAt)
      lines.push(csvRow([
        date,
        meta?.title ?? '',
        '', // Year — not stored; Letterboxd matches by name (best-effort)
        '', // Letterboxd URI — we don't have a mapping
        ratingToStars(h.myRating ?? meta?.rating ?? null),
        seenViaHistory.has(h.tmdbId) ? 'Yes' : '',
        '', // Tags
        date,
      ]))
      seenViaHistory.add(h.tmdbId)
    }

    for (const w of wmRows) {
      if (seenViaHistory.has(w.tmdbId)) continue
      const date = isoDateOnly(w.watchedAt)
      lines.push(csvRow([
        date,
        w.title,
        '',
        '',
        ratingToStars(w.myRating),
        '',
        '',
        date,
      ]))
    }

    const filename = `birceflix-letterboxd-${isoDateOnly(new Date())}.csv`
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .send(lines.join('\n') + '\n')
  })
}
