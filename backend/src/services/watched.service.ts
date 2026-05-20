import { and, desc, eq } from 'drizzle-orm'
import type { DB } from '../db/client.js'
import { watchedMovies } from '../db/schema.js'

export interface UpsertWatchedInput {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  imdbId?: string | null
  title: string
  posterPath?: string | null
  myRating?: number | null
  notes?: string | null
}

export interface UpdateWatchedInput {
  myRating?: number | null
  notes?: string | null
}

export class WatchedService {
  constructor(private db: DB) {}

  async getWatched(userId: string) {
    return this.db
      .select()
      .from(watchedMovies)
      .where(eq(watchedMovies.userId, userId))
      .orderBy(desc(watchedMovies.watchedAt))
  }

  async getWatchedItem(userId: string, tmdbId: number, mediaType: 'movie' | 'tv') {
    const [row] = await this.db
      .select()
      .from(watchedMovies)
      .where(
        and(
          eq(watchedMovies.userId, userId),
          eq(watchedMovies.tmdbId, tmdbId),
          eq(watchedMovies.mediaType, mediaType)
        )
      )
      .limit(1)
    return row ?? null
  }

  async upsertWatched(userId: string, input: UpsertWatchedInput) {
    const values = {
      userId,
      tmdbId: input.tmdbId,
      mediaType: input.mediaType,
      imdbId: input.imdbId ?? null,
      title: input.title,
      posterPath: input.posterPath ?? null,
      myRating: input.myRating ?? null,
      notes: input.notes ?? null,
    }

    await this.db
      .insert(watchedMovies)
      .values(values)
      .onConflictDoUpdate({
        target: [watchedMovies.userId, watchedMovies.tmdbId, watchedMovies.mediaType],
        set: {
          imdbId: input.imdbId ?? null,
          title: input.title,
          posterPath: input.posterPath ?? null,
          myRating: input.myRating ?? null,
          notes: input.notes ?? null,
        },
      })
  }

  async updateWatched(userId: string, tmdbId: number, mediaType: 'movie' | 'tv', input: UpdateWatchedInput) {
    const update: Partial<{ myRating: number | null; notes: string | null }> = {}
    if (input.myRating !== undefined) update.myRating = input.myRating
    if (input.notes !== undefined) update.notes = input.notes

    const result = await this.db
      .update(watchedMovies)
      .set(update)
      .where(
        and(
          eq(watchedMovies.userId, userId),
          eq(watchedMovies.tmdbId, tmdbId),
          eq(watchedMovies.mediaType, mediaType)
        )
      )
      .returning({ id: watchedMovies.id })

    return result.length > 0
  }

  async deleteWatched(userId: string, tmdbId: number, mediaType: 'movie' | 'tv') {
    await this.db
      .delete(watchedMovies)
      .where(
        and(
          eq(watchedMovies.userId, userId),
          eq(watchedMovies.tmdbId, tmdbId),
          eq(watchedMovies.mediaType, mediaType)
        )
      )
  }
}
