import { pgTable, uuid, text, timestamp, integer, smallint, primaryKey, index, uniqueIndex, check } from 'drizzle-orm/pg-core'
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
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
    priority: smallint('priority').default(0).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.tmdbId] }),
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

export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type WatchedMovie = typeof watchedMovies.$inferSelect
export type WatchlistItem = typeof watchlist.$inferSelect
export type WatchHistoryItem = typeof watchHistory.$inferSelect
