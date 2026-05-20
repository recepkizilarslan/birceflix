import { and, desc, eq } from 'drizzle-orm'
import type { DB } from '../db/client.js'
import { watchlist } from '../db/schema.js'

export interface AddWatchlistInput {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath?: string | null
  priority?: number
}

export class WatchlistService {
  constructor(private db: DB) {}

  async getWatchlist(userId: string, page = 1, limit = 50) {
    return this.db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(desc(watchlist.priority), desc(watchlist.addedAt))
      .limit(limit)
      .offset((page - 1) * limit)
  }

  async addToWatchlist(userId: string, input: AddWatchlistInput) {
    await this.db
      .insert(watchlist)
      .values({
        userId,
        tmdbId: input.tmdbId,
        mediaType: input.mediaType,
        title: input.title,
        posterPath: input.posterPath ?? null,
        priority: input.priority ?? 0,
      })
      .onConflictDoUpdate({
        target: [watchlist.userId, watchlist.tmdbId, watchlist.mediaType],
        set: {
          title: input.title,
          posterPath: input.posterPath ?? null,
          priority: input.priority ?? 0,
        },
      })
  }

  async removeFromWatchlist(userId: string, tmdbId: number, mediaType: 'movie' | 'tv') {
    await this.db
      .delete(watchlist)
      .where(
        and(
          eq(watchlist.userId, userId),
          eq(watchlist.tmdbId, tmdbId),
          eq(watchlist.mediaType, mediaType)
        )
      )
  }
}
