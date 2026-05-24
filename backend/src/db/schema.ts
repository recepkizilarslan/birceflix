import { pgTable, uuid, text, timestamp, integer, smallint, boolean, jsonb, primaryKey, index, uniqueIndex, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Users — one row per real person. Auth is either Google OAuth, an
// email+password pair, or both linked on the same row (matched by email).
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Null when the user only registered with email+password. */
  googleSub: text('google_sub').unique(),
  email: text('email').notNull().unique(),
  /** scrypt-derived hash. Format: "<hex-salt>:<hex-derived>". Null for Google-only accounts. */
  passwordHash: text('password_hash'),
  /** Denormalised full name. Kept in sync as `${firstName} ${lastName}`. */
  name: text('name'),
  firstName: text('first_name'),
  lastName: text('last_name'),
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
// Watched titles — one row per (user, tmdb_id, media_type). Table name kept
// as `watched_movies` for backwards-compat; rows now include TV shows too
// (media_type='tv'). Episode-level tracking still lives in watched_episodes.
// ---------------------------------------------------------------------------
export const watchedMovies = pgTable(
  'watched_movies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tmdbId: integer('tmdb_id').notNull(),
    /** 'movie' | 'tv'. Defaults to 'movie' for backfill. */
    mediaType: text('media_type').notNull().default('movie'),
    imdbId: text('imdb_id'),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    watchedAt: timestamp('watched_at', { withTimezone: true }).defaultNow().notNull(),
    myRating: smallint('my_rating'),
    notes: text('notes'),
  },
  (t) => ({
    userMediaUnique: uniqueIndex('watched_user_tmdb_type_unique').on(t.userId, t.tmdbId, t.mediaType),
    userIdx: index('watched_user_idx').on(t.userId, t.watchedAt),
    ratingCheck: check('watched_rating_range', sql`${t.myRating} is null or (${t.myRating} between 1 and 10)`),
  }),
)

// ---------------------------------------------------------------------------
// Watchlist — "want to watch" queue, separate from watched. Holds both
// movies and TV shows disambiguated by media_type.
// ---------------------------------------------------------------------------
export const watchlist = pgTable(
  'watchlist',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tmdbId: integer('tmdb_id').notNull(),
    /** 'movie' | 'tv'. Defaults to 'movie' for backfill. */
    mediaType: text('media_type').notNull().default('movie'),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
    priority: smallint('priority').default(0).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.tmdbId, t.mediaType] }),
    userAddedIdx: index('watchlist_user_added_idx').on(t.userId, t.addedAt),
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
    /** 'movie' | 'tv'. Defaults to 'movie' for backfill. Distinguishes the
     * TMDB namespace so movie 1396 and TV 1396 can both live in the same
     * list, and so the UI can route each entry to the correct detail page. */
    mediaType: text('media_type').notNull().default('movie'),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    position: smallint('position').default(0).notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.listId, t.tmdbId, t.mediaType] }),
    listOrderIdx: index('list_items_list_order_idx').on(t.listId, t.position, t.addedAt),
  }),
)

// ---------------------------------------------------------------------------
// Saved discover filters — a named snapshot of the discover-page FilterState
// the user can reapply with one click from the sidebar.
// ---------------------------------------------------------------------------
export const savedFilters = pgTable(
  'saved_filters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    /** 'movie' | 'tv' | 'doc' — keeps the badge consistent when reapplied. */
    mediaType: text('media_type').notNull(),
    /** Full serialised FilterState. Shape is owned by the frontend. */
    filters: jsonb('filters').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('saved_filters_user_idx').on(t.userId, t.createdAt),
  }),
)

export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type WatchedMovie = typeof watchedMovies.$inferSelect
export type WatchlistItem = typeof watchlist.$inferSelect
export type SavedFilter = typeof savedFilters.$inferSelect
