import type { FastifyInstance } from 'fastify'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  listItems,
  lists,
  users,
  watchedEpisodes,
  watchedMovies,
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
  // lgtm [js/missing-rate-limiting]
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

    const [wm, wl, we, ls] = await Promise.all([
      db.select().from(watchedMovies).where(eq(watchedMovies.userId, userId)).orderBy(desc(watchedMovies.watchedAt)),
      db.select().from(watchlist).where(eq(watchlist.userId, userId)).orderBy(desc(watchlist.addedAt)),
      db.select().from(watchedEpisodes).where(eq(watchedEpisodes.userId, userId)).orderBy(desc(watchedEpisodes.watchedAt)),
      db.select().from(lists).where(eq(lists.userId, userId)).orderBy(desc(lists.updatedAt)),
    ])

    // Hydrate list items for each list.
    //
    // Used to be Promise.all over `ls`, issuing one SELECT per list — N+1 in
    // DB roundtrips for a user with many lists. Now: single query joining
    // by listId IN (ids), then group by listId in JS. One roundtrip instead
    // of N. Empty-lists case handled separately (IN () is a syntax error).
    const listIds = ls.map((l) => l.id)
    const allItems = listIds.length === 0
      ? []
      : await db
          .select()
          .from(listItems)
          .where(inArray(listItems.listId, listIds))
          .orderBy(asc(listItems.position), asc(listItems.addedAt))

    const itemsByListId = new Map<string, typeof allItems>()
    for (const it of allItems) {
      const bucket = itemsByListId.get(it.listId) ?? []
      bucket.push(it)
      itemsByListId.set(it.listId, bucket)
    }

    const listsWithItems = ls.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      is_public: l.isPublic,
      public_slug: l.publicSlug,
      created_at: l.createdAt.toISOString(),
      updated_at: l.updatedAt.toISOString(),
      items: (itemsByListId.get(l.id) ?? []).map((i) => ({
        tmdb_id: i.tmdbId,
        media_type: i.mediaType,
        title: i.title,
        poster_path: i.posterPath,
        position: i.position,
        added_at: i.addedAt.toISOString(),
      })),
    }))

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
   * Per-viewing history was dropped in migration 0012, so every row here is
   * sourced from watched_movies and the Rewatch column is always empty.
   * Users who want true rewatch tracking on the way out should rely on
   * Letterboxd's own diary on the destination side instead.
   */
  // lgtm [js/missing-rate-limiting]
  app.get('/api/export/letterboxd-diary.csv', rlRead, async (req, reply) => {
    const userId = await app.requireAuth(req)

    const wmRows = await db
      .select()
      .from(watchedMovies)
      .where(eq(watchedMovies.userId, userId))
      .orderBy(asc(watchedMovies.watchedAt))

    const lines: string[] = []
    lines.push('Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date')
    for (const w of wmRows) {
      const date = isoDateOnly(w.watchedAt)
      lines.push(csvRow([
        date,
        w.title,
        '', // Year — not stored; Letterboxd matches by name (best-effort)
        '', // Letterboxd URI — we don't have a mapping
        ratingToStars(w.myRating),
        '', // Rewatch — never set, no per-viewing history to flag against
        '', // Tags
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
