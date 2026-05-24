/**
 * Quiz Tournament Routes
 *
 * Powers the 1v1 elimination tournament feature. Each category maps to a
 * TMDB data source (top_rated movies, top_rated TV, documentary discover).
 * Items are fetched via the existing topCache so we never hit TMDB per-
 * request during active gameplay.
 *
 * Tournament logic:
 *   - `remaining` array stores the bracket in order. Round N pairs up
 *     adjacent items: [0] vs [1], [2] vs [3], …
 *   - A vote removes the loser from `remaining` and prepends it to
 *     `eliminated`. When `remaining.length === 1` the tournament is done.
 *   - After every complete round (all pairs resolved) `current_round` is
 *     incremented.
 *   - Global stats are UPSERT-ed per matchup (candidateA < candidateB,
 *     enforced here) so the "X% picked this" overlay stays accurate.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { quizSessions, quizVotes, quizGlobalStats } from '../db/schema.js'
import { getTop } from '../lib/topCache.js'
import { env } from '../env.js'
import { uiLanguageSchema } from '../lib/locale.js'
import { tmdb } from '../lib/tmdb.js'

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------
type MediaTypeShort = 'movie' | 'tv' | 'doc'

interface CategoryDef {
  id: string
  labelTr: string
  labelEn: string
  mediaType: MediaTypeShort
  /** Maximum items to put into the bracket. Must be a power of 2. */
  maxItems: 16 | 32 | 64 | 128
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'top_movies',
    labelTr: 'En İyi Filmler',
    labelEn: 'Top Movies',
    mediaType: 'movie',
    maxItems: 64,
  },
  {
    id: 'top_tv',
    labelTr: 'En İyi Diziler',
    labelEn: 'Top TV Shows',
    mediaType: 'tv',
    maxItems: 64,
  },
  {
    id: 'top_docs',
    labelTr: 'En İyi Belgeseller',
    labelEn: 'Top Documentaries',
    mediaType: 'doc',
    maxItems: 32,
  },
]

/** Shuffle an array in-place (Fisher-Yates) and return it. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/** Round n up to the next power of 2, capped at max. */
function nearestPow2(n: number, max: number): number {
  let p = 1
  while (p < n && p < max) p <<= 1
  return Math.min(p, max)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the tmdbIds for a category, leveraging topCache for movies/TV.
 * Documentaries use a dedicated TMDB discover call (not in topCache).
 */
async function fetchCategoryIds(
  cat: CategoryDef,
  region: string,
  language: string,
  log: FastifyInstance['log'],
): Promise<number[]> {
  if (cat.mediaType === 'movie' || cat.mediaType === 'tv') {
    const snapshot = await getTop(cat.mediaType, region, language, log)
    return snapshot.items.map((i) => i.id)
  }

  // Documentaries: genre 99 on TMDB, sorted by vote_average
  const PAGE_SIZE = 20
  const pagesNeeded = Math.ceil(cat.maxItems / PAGE_SIZE)
  const pages = await Promise.all(
    Array.from({ length: pagesNeeded }, (_, i) =>
      tmdb<{ results: { id: number }[] }>('/discover/movie', {
        with_genres: '99',
        sort_by: 'vote_average.desc',
        'vote_count.gte': '500',
        language,
        page: String(i + 1),
      }),
    ),
  )
  return pages.flatMap((p) => p.results.map((r) => r.id)).slice(0, cat.maxItems)
}

/**
 * Compute the ordered (a, b) key where a < b.
 * Returns [smallerId, largerId].
 */
function orderedPair(x: number, y: number): [number, number] {
  return x < y ? [x, y] : [y, x]
}

/**
 * Read the current duel from a session's `remaining` array.
 * Items at even index vs odd index.
 */
function currentDuel(remaining: number[]): [number, number] | null {
  if (remaining.length < 2) return null
  const a = remaining[0]
  const b = remaining[1]
  if (a === undefined || b === undefined) return null
  return [a, b]
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function quizRoutes(app: FastifyInstance) {
  // ── GET /api/quiz/categories ─────────────────────────────────────────────
  app.get('/api/quiz/categories', async (req) => {
    const userId = await app.requireAuth(req)
    void userId // auth check only

    // Fetch the latest active (incomplete) session per category so the UI
    // can show a "Resume" badge.
    const activeSessions = await db
      .select({
        category: quizSessions.category,
        id: quizSessions.id,
        currentRound: quizSessions.currentRound,
        totalItems: quizSessions.totalItems,
        remaining: quizSessions.remaining,
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          sql`${quizSessions.completedAt} IS NULL`,
        ),
      )
      .orderBy(desc(quizSessions.updatedAt))

    const activeByCategory = new Map(activeSessions.map((s) => [s.category, s]))

    return CATEGORIES.map((cat) => {
      const active = activeByCategory.get(cat.id)
      return {
        id: cat.id,
        label_tr: cat.labelTr,
        label_en: cat.labelEn,
        media_type: cat.mediaType,
        max_items: cat.maxItems,
        active_session: active
          ? {
              id: active.id,
              current_round: active.currentRound,
              total_items: active.totalItems,
              remaining_count: (active.remaining as number[]).length,
            }
          : null,
      }
    })
  })

  // ── POST /api/quiz/sessions ──────────────────────────────────────────────
  // Creates a new tournament session (or resumes the latest active one if
  // ?resume=true is passed — useful for the "Continue" flow).
  const createSchema = z.object({
    category: z.string(),
    region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
    ui_language: uiLanguageSchema,
    /** If true, return the active unfinished session for this category
     *  instead of creating a new one. */
    resume: z.coerce.boolean().default(false),
  })

  app.post('/api/quiz/sessions', async (req) => {
    const userId = await app.requireAuth(req)
    const body = createSchema.parse(req.body)

    const cat = CATEGORIES.find((c) => c.id === body.category)
    if (!cat) throw app.httpErrors.badRequest(`Unknown category: ${body.category}`)

    // Resume path: return the existing unfinished session.
    if (body.resume) {
      const [existing] = await db
        .select()
        .from(quizSessions)
        .where(
          and(
            eq(quizSessions.userId, userId),
            eq(quizSessions.category, body.category),
            sql`${quizSessions.completedAt} IS NULL`,
          ),
        )
        .orderBy(desc(quizSessions.updatedAt))
        .limit(1)

      if (existing) return existing
    }

    // New session: fetch ids, shuffle, size the bracket.
    const allIds = await fetchCategoryIds(cat, body.region.toUpperCase(), body.ui_language, app.log)
    const bracketSize = nearestPow2(allIds.length, cat.maxItems)
    // Shuffle then take bracketSize items so the bracket is random each time.
    const remaining = shuffle(allIds.slice()).slice(0, bracketSize)

    const [session] = await db
      .insert(quizSessions)
      .values({
        userId,
        category: cat.id,
        categoryLabel: cat.labelTr,
        totalItems: bracketSize,
        currentRound: 1,
        remaining,
        eliminated: [],
      })
      .returning()

    return session
  })

  // ── GET /api/quiz/sessions/:id ───────────────────────────────────────────
  app.get('/api/quiz/sessions/:id', async (req) => {
    const userId = await app.requireAuth(req)
    const { id } = req.params as { id: string }

    const [session] = await db
      .select()
      .from(quizSessions)
      .where(and(eq(quizSessions.id, id), eq(quizSessions.userId, userId)))
      .limit(1)

    if (!session) throw app.httpErrors.notFound('Session not found')
    return session
  })

  // ── POST /api/quiz/sessions/:id/vote ────────────────────────────────────
  const voteSchema = z.object({
    winner: z.number().int().positive(),
    /** Loser id — validated against the current duel. */
    loser: z.number().int().positive(),
  })

  app.post('/api/quiz/sessions/:id/vote', async (req) => {
    const userId = await app.requireAuth(req)
    const { id } = req.params as { id: string }
    const body = voteSchema.parse(req.body)

    const [session] = await db
      .select()
      .from(quizSessions)
      .where(and(eq(quizSessions.id, id), eq(quizSessions.userId, userId)))
      .limit(1)

    if (!session) throw app.httpErrors.notFound('Session not found')
    if (session.completedAt) throw app.httpErrors.conflict('Tournament already completed')

    const remaining = session.remaining as number[]
    const duel = currentDuel(remaining)
    if (!duel) throw app.httpErrors.conflict('No active duel')

    const [candA, candB] = duel
    const { winner, loser } = body

    // Validate the vote is for the current duel.
    if (
      (winner !== candA && winner !== candB) ||
      (loser !== candA && loser !== candB) ||
      winner === loser
    ) {
      throw app.httpErrors.badRequest('Vote does not match current duel')
    }

    // Remove the first two items (the current duel pair) and append the winner.
    const newRemaining = [...remaining.slice(2), winner]
    const newEliminated = [loser, ...(session.eliminated as number[])]

    // Detect round completion: we entered this vote with an even remaining count
    // (one full pair). After removing 2 and adding 1, if the new count is a
    // power of 2 that's smaller than the previous, the round just ended.
    const prevLen = remaining.length
    const nextLen = newRemaining.length

    // The round increments when all pairs in the current round have been
    // resolved, i.e. when the remaining list has shrunk to exactly half its
    // length at the start of this round.
    const roundJustCompleted = nextLen > 0 && prevLen % 2 === 0 && nextLen === prevLen / 2
    const newRound = roundJustCompleted ? session.currentRound + 1 : session.currentRound

    // Record the vote
    await db.insert(quizVotes).values({
      sessionId: session.id,
      userId,
      round: session.currentRound,
      candidateA: candA,
      candidateB: candB,
      winner,
    })

    // Update global stats (candidate_a < candidate_b invariant)
    const [statA, statB] = orderedPair(candA, candB)
    const mediaType =
      CATEGORIES.find((c) => c.id === session.category)?.mediaType ?? 'movie'

    await db
      .insert(quizGlobalStats)
      .values({
        candidateA: statA,
        candidateB: statB,
        mediaType,
        winsA: winner === statA ? 1 : 0,
        winsB: winner === statB ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [quizGlobalStats.candidateA, quizGlobalStats.candidateB, quizGlobalStats.mediaType],
        set: {
          winsA: sql`${quizGlobalStats.winsA} + ${winner === statA ? 1 : 0}`,
          winsB: sql`${quizGlobalStats.winsB} + ${winner === statB ? 1 : 0}`,
          updatedAt: sql`now()`,
        },
      })

    // Check if tournament is over
    const isComplete = newRemaining.length === 1
    const winnerId = isComplete ? newRemaining[0]! : null

    // Update session
    const [updated] = await db
      .update(quizSessions)
      .set({
        remaining: newRemaining,
        eliminated: newEliminated,
        currentRound: newRound,
        ...(isComplete
          ? {
              winnerId,
              completedAt: new Date(),
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(quizSessions.id, id))
      .returning()

    return updated
  })

  // ── GET /api/quiz/sessions/:id/result ───────────────────────────────────
  app.get('/api/quiz/sessions/:id/result', async (req) => {
    const userId = await app.requireAuth(req)
    const { id } = req.params as { id: string }

    const [session] = await db
      .select()
      .from(quizSessions)
      .where(and(eq(quizSessions.id, id), eq(quizSessions.userId, userId)))
      .limit(1)

    if (!session) throw app.httpErrors.notFound('Session not found')
    if (!session.completedAt) throw app.httpErrors.conflict('Tournament not yet complete')

    return session
  })

  // ── GET /api/quiz/stats ──────────────────────────────────────────────────
  // ?a=<tmdbId>&b=<tmdbId>&media_type=movie|tv|doc
  const statsSchema = z.object({
    a: z.coerce.number().int().positive(),
    b: z.coerce.number().int().positive(),
    media_type: z.enum(['movie', 'tv', 'doc']).default('movie'),
  })

  app.get('/api/quiz/stats', async (req) => {
    await app.requireAuth(req)
    const { a, b, media_type } = statsSchema.parse(req.query)
    const [statA, statB] = orderedPair(a, b)

    const [row] = await db
      .select()
      .from(quizGlobalStats)
      .where(
        and(
          eq(quizGlobalStats.candidateA, statA),
          eq(quizGlobalStats.candidateB, statB),
          eq(quizGlobalStats.mediaType, media_type),
        ),
      )
      .limit(1)

    if (!row) {
      return { candidate_a: statA, candidate_b: statB, wins_a: 0, wins_b: 0, total: 0, pct_a: 50, pct_b: 50 }
    }

    const total = row.winsA + row.winsB
    return {
      candidate_a: row.candidateA,
      candidate_b: row.candidateB,
      wins_a: row.winsA,
      wins_b: row.winsB,
      total,
      pct_a: total === 0 ? 50 : Math.round((row.winsA / total) * 100),
      pct_b: total === 0 ? 50 : Math.round((row.winsB / total) * 100),
    }
  })

  // ── GET /api/quiz/history ────────────────────────────────────────────────
  // Returns the user's completed sessions (most recent first).
  app.get('/api/quiz/history', async (req) => {
    const userId = await app.requireAuth(req)

    const rows = await db
      .select({
        id: quizSessions.id,
        category: quizSessions.category,
        categoryLabel: quizSessions.categoryLabel,
        totalItems: quizSessions.totalItems,
        winnerId: quizSessions.winnerId,
        winnerTitle: quizSessions.winnerTitle,
        winnerPosterPath: quizSessions.winnerPosterPath,
        completedAt: quizSessions.completedAt,
        createdAt: quizSessions.createdAt,
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          sql`${quizSessions.completedAt} IS NOT NULL`,
        ),
      )
      .orderBy(desc(quizSessions.completedAt))
      .limit(20)

    return rows
  })
}
