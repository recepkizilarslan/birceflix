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
 *
 * Rate limiting:
 *   Inline configs are used (not imported constants) so CodeQL data-flow
 *   can resolve the rateLimit option without cross-file tracking.
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
// Inline rate limit configs (intentionally NOT imported from rateLimit.ts so
// CodeQL can resolve the value through its local data-flow analysis).
// ---------------------------------------------------------------------------
const RL_READ  = { config: { rateLimit: { max: 200, timeWindow: '1 minute' } } } as const
const RL_WRITE = { config: { rateLimit: { max: 60,  timeWindow: '1 minute' } } } as const

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
    labelEn: 'Top TV',
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Nearest power-of-2 ≤ max that is also ≤ available. */
function nearestPow2(available: number, max: number): number {
  const cap = Math.min(available, max)
  let p = 1
  while (p * 2 <= cap) p *= 2
  return p
}

/** Fisher-Yates in-place shuffle. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/** Returns the current duel pair from the remaining array. */
function currentDuel(remaining: number[]): [number, number] | null {
  if (remaining.length < 2) return null
  const a = remaining[0]
  const b = remaining[1]
  if (a === undefined || b === undefined) return null
  return [a, b]
}

/** Canonical pair order: smaller id first. */
function orderedPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a]
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------
interface TmdbDiscoverResult {
  id: number
  vote_average?: number
}

async function fetchCategoryIds(
  cat: CategoryDef,
  region: string,
  uiLang: string,
  log: FastifyInstance['log'],
  platformId?: number,
): Promise<number[]> {
  if (cat.mediaType === 'movie') {
    const snapshot = await getTop('movie', region, uiLang, log)
    return snapshot.items.map((r) => r.id)
  }

  if (cat.mediaType === 'tv') {
    const snapshot = await getTop('tv', region, uiLang, log)
    return snapshot.items.map((r) => r.id)
  }

  // Documentary: use TMDB discover with genre 99
  const pages = [1, 2, 3]
  const params: Record<string, string> = {
    with_genres: '99',
    sort_by: 'vote_average.desc',
    'vote_count.gte': '200',
    language: uiLang,
  }
  if (platformId) params['with_watch_providers'] = String(platformId)

  const allResults: TmdbDiscoverResult[] = []

  for (const page of pages) {
    try {
      const data = await tmdb<{ results: TmdbDiscoverResult[] }>('/discover/movie', {
        ...params,
        page: String(page),
      })
      allResults.push(...data.results)
    } catch (err) {
      log.warn({ err, page }, 'quiz: documentary fetch failed for page')
    }
  }

  // Sort by vote_average descending (already sorted by TMDB, but make explicit)
  allResults.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))

  return allResults.map((r) => r.id)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function quizRoutes(app: FastifyInstance) {
  // ── GET /api/quiz/categories ─────────────────────────────────────────────
  // lgtm [js/missing-rate-limiting]
  app.get('/api/quiz/categories', RL_READ, async (req) => {
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
    resume: z.coerce.boolean().default(false),
    bracket_size: z.coerce.number().int().positive().optional(),
    platform_id: z.coerce.number().int().positive().optional(),
  })

  // lgtm [js/missing-rate-limiting]
  app.post('/api/quiz/sessions', RL_WRITE, async (req) => {
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
    const allIds = await fetchCategoryIds(
      cat,
      body.region.toUpperCase(),
      body.ui_language,
      app.log,
      body.platform_id,
    )
    const requestedSize = body.bracket_size ?? cat.maxItems
    const bracketSize = nearestPow2(Math.min(allIds.length, requestedSize), cat.maxItems)

    // First, take the absolute Top N items from the sorted list
    const topIds = allIds.slice(0, bracketSize)
    // Then shuffle them so the tournament bracket matchups are random
    const remaining = shuffle(topIds)

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
  // lgtm [js/missing-rate-limiting]
  app.get('/api/quiz/sessions/:id', RL_READ, async (req) => {
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

  // lgtm [js/missing-rate-limiting]
  app.post('/api/quiz/sessions/:id/vote', RL_WRITE, async (req) => {
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

    const updated = await db.transaction(async (tx) => {
      // Record the vote
      await tx.insert(quizVotes).values({
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

      await tx
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
      const [res] = await tx
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

      return res
    })

    return updated
  })

  // ── POST /api/quiz/metadata ──────────────────────────────────────────────
  // Lightweight metadata fetch for missing items (docs, platform filters).
  // lgtm [js/missing-rate-limiting]
  app.post('/api/quiz/metadata', RL_READ, async (req) => {
    await app.requireAuth(req)
    const body = z.object({
      items: z.array(z.object({ id: z.number(), type: z.enum(['movie', 'tv']) })),
      language: uiLanguageSchema,
    }).parse(req.body)

    const results = await Promise.allSettled(
      body.items.map(async (item) => {
        const detail = await tmdb<any>(`/${item.type}/${item.id}`, { language: body.language })
        const title = detail.title || detail.name || `#${item.id}`
        const date = detail.release_date || detail.first_air_date || null
        const year = date ? date.split('-')[0] : null
        return {
          id: item.id,
          title,
          poster_path: detail.poster_path || null,
          year,
        }
      })
    )

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value)
  })

  // ── GET /api/quiz/sessions/:id/result ───────────────────────────────────
  // lgtm [js/missing-rate-limiting]
  app.get('/api/quiz/sessions/:id/result', RL_READ, async (req) => {
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

  // lgtm [js/missing-rate-limiting]
  app.get('/api/quiz/stats', RL_READ, async (req) => {
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
  // lgtm [js/missing-rate-limiting]
  app.get('/api/quiz/history', RL_READ, async (req) => {
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
