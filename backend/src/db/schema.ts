import { pgTable, uuid, text, timestamp, integer, smallint, boolean, primaryKey, index, uniqueIndex, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Users — Google-authenticated, one row per real person
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // Trakt integration — null until the user connects.
  traktAccessToken: text('trakt_access_token'),
  traktRefreshToken: text('trakt_refresh_token'),
  traktExpiresAt: timestamp('trakt_expires_at', { withTimezone: true }),
  traktLastSyncAt: timestamp('trakt_last_sync_at', { withTimezone: true }),
})

// ---------------------------------------------------------------------------
// Sessions — server-side session store; cookie carries the id only
// ---------------------------------------------------------------------------
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
)

// ---------------------------------------------------------------------------
// Watched movies — current behaviour: one row per (user, movie)
// (Future: split into watch_history for rewatches, see Roadmap.)
// ---------------------------------------------------------------------------
export const watchedMovies = pgTable(
  'watched_movies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tmdbId: integer('tmdb_id').notNull(),
    imdbId: text('imdb_id'),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    watchedAt: timestamp('watched_at', { withTimezone: true }).defaultNow().notNull(),
    myRating: smallint('my_rating'),
    notes: text('notes'),
  },
  (t) => ({
    userMovieUnique: uniqueIndex('watched_user_movie_unique').on(t.userId, t.tmdbId),
    userIdx: index('watched_user_idx').on(t.userId, t.watchedAt),
    ratingCheck: check('watched_rating_range', sql`${t.myRating} is null or (${t.myRating} between 1 and 10)`),
  }),
)

// ---------------------------------------------------------------------------
// Watchlist — "want to watch" queue, separate from watched
// ---------------------------------------------------------------------------
export const watchlist = pgTable(
  'watchlist',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tmdbId: integer('tmdb_id').notNull(),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
    priority: smallint('priority').default(0).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.tmdbId] }),
    userAddedIdx: index('watchlist_user_added_idx').on(t.userId, t.addedAt),
  }),
)

// ---------------------------------------------------------------------------
// Watch history — one row per viewing event (Movary-style rewatch support)
// ---------------------------------------------------------------------------
export const watchHistory = pgTable(
  'watch_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tmdbId: integer('tmdb_id').notNull(),
    watchedAt: timestamp('watched_at', { withTimezone: true }).defaultNow().notNull(),
    myRating: smallint('my_rating'),
    location: text('location'),
    notes: text('notes'),
  },
  (t) => ({
    userIdx: index('history_user_idx').on(t.userId, t.watchedAt),
    movieIdx: index('history_user_movie_idx').on(t.userId, t.tmdbId),
  }),
)

// ---------------------------------------------------------------------------
// Watched TV episodes — one row per (user, show, season, episode)
// ---------------------------------------------------------------------------
export const watchedEpisodes = pgTable(
  'watched_episodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** TMDB tv show id. */
    showId: integer('show_id').notNull(),
    /** Denormalised so the watched-shows list doesn't need a TMDB roundtrip. */
    showName: text('show_name').notNull(),
    showPosterPath: text('show_poster_path'),
    seasonNumber: integer('season_number').notNull(),
    episodeNumber: integer('episode_number').notNull(),
    episodeName: text('episode_name'),
    watchedAt: timestamp('watched_at', { withTimezone: true }).defaultNow().notNull(),
    myRating: smallint('my_rating'),
    notes: text('notes'),
  },
  (t) => ({
    userUnique: uniqueIndex('watched_episodes_user_unique').on(
      t.userId,
      t.showId,
      t.seasonNumber,
      t.episodeNumber,
    ),
    userShowIdx: index('watched_episodes_user_show_idx').on(t.userId, t.showId),
    userTimeIdx: index('watched_episodes_user_time_idx').on(t.userId, t.watchedAt),
  }),
)

// ---------------------------------------------------------------------------
// User-defined lists — "Favori Wes Anderson", "Yılbaşı izleme planı" etc.
// ---------------------------------------------------------------------------
export const lists = pgTable(
  'lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isPublic: boolean('is_public').default(false).notNull(),
    /** Random short token used for public URLs (/lists/public/<slug>); null until shared. */
    publicSlug: text('public_slug').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('lists_user_idx').on(t.userId, t.createdAt),
  }),
)

export const listItems = pgTable(
  'list_items',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    tmdbId: integer('tmdb_id').notNull(),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    position: smallint('position').default(0).notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.listId, t.tmdbId] }),
    listOrderIdx: index('list_items_list_order_idx').on(t.listId, t.position, t.addedAt),
  }),
)

// ---------------------------------------------------------------------------
// Webhook tokens — per-user opaque secrets used by Plex/Jellyfin to POST
// scrobble events. Multiple tokens are supported per user so a single
// compromised host can be rotated without touching the others.
// ---------------------------------------------------------------------------
export const webhookTokens = pgTable(
  'webhook_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Opaque random string used in the public webhook URL. */
    token: text('token').notNull().unique(),
    /** User-facing label, e.g. 'Plex (ev)' or 'Jellyfin (sunucu)'. */
    label: text('label').notNull(),
    /** When the token was last hit by a scrobble. Null until first use. */
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('webhook_tokens_user_idx').on(t.userId),
  }),
)

export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type WatchedMovie = typeof watchedMovies.$inferSelect
export type WatchlistItem = typeof watchlist.$inferSelect
export type WatchHistoryItem = typeof watchHistory.$inferSelect
