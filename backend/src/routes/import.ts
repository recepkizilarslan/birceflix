import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { watchedMovies, watchHistory } from '../db/schema.js'
import {
  findTmdbMatch,
  letterboxdRatingTo10,
  parseLetterboxdDiary,
  parseLetterboxdWatched,
  type LetterboxdDiaryRow,
  type LetterboxdWatchedRow,
} from '../lib/letterboxd.js'
import { rlWrite } from '../lib/rateLimit.js'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB — Letterboxd CSVs are typically tens of KB.

interface ImportReport {
  total: number
  matched: number
  unmatched: { name: string; year: number | null; reason: string }[]
}

async function readCsv(req: { file: () => Promise<{ toBuffer: () => Promise<Buffer> } | undefined> }): Promise<string> {
  const part = await req.file()
  if (!part) throw new Error('no file uploaded (expected multipart "file" field)')
  const buf = await part.toBuffer()
  if (buf.length > MAX_BYTES) throw new Error(`file too large (${buf.length} > ${MAX_BYTES})`)
  return buf.toString('utf8')
}

/**
 * Process rows with small concurrency to stay polite to TMDB.
 * We sequentially advance through batches; each batch resolves N in parallel.
 */
async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size)
    const results = await Promise.all(slice.map(fn))
    out.push(...results)
  }
  return out
}

export async function importRoutes(app: FastifyInstance) {
  // -------- Letterboxd: watched.csv → watched_movies ----------------------
  // lgtm [js/missing-rate-limiting]
  app.post('/api/import/letterboxd/watched', rlWrite, async (req, reply) => {
    const userId = await app.requireAuth(req)
    const csv = await readCsv(req as unknown as { file: () => Promise<{ toBuffer: () => Promise<Buffer> } | undefined> })
    let rows: LetterboxdWatchedRow[]
    try {
      rows = parseLetterboxdWatched(csv)
    } catch (e) {
      return reply.code(400).send({ error: 'csv parse failed', detail: (e as Error).message })
    }

    const report: ImportReport = { total: rows.length, matched: 0, unmatched: [] }

    await inBatches(rows, 5, async (row) => {
      let match: Awaited<ReturnType<typeof findTmdbMatch>> = null
      try {
        match = await findTmdbMatch(row.name, row.year)
      } catch (e) {
        report.unmatched.push({ name: row.name, year: row.year, reason: 'tmdb error: ' + (e as Error).message })
        return
      }
      if (!match) {
        report.unmatched.push({ name: row.name, year: row.year, reason: 'no tmdb result' })
        return
      }
      await db
        .insert(watchedMovies)
        .values({
          userId,
          tmdbId: match.id,
          mediaType: 'movie',
          title: match.title,
          posterPath: match.poster_path ?? null,
        })
        // (user_id, tmdb_id, media_type) is the actual unique index since 0009.
        .onConflictDoNothing({
          target: [watchedMovies.userId, watchedMovies.tmdbId, watchedMovies.mediaType],
        })
      report.matched++
    })

    return report
  })

  // -------- Letterboxd: diary.csv → watch_history -------------------------
  // lgtm [js/missing-rate-limiting]
  app.post('/api/import/letterboxd/diary', rlWrite, async (req, reply) => {
    const userId = await app.requireAuth(req)
    const csv = await readCsv(req as unknown as { file: () => Promise<{ toBuffer: () => Promise<Buffer> } | undefined> })
    let rows: LetterboxdDiaryRow[]
    try {
      rows = parseLetterboxdDiary(csv)
    } catch (e) {
      return reply.code(400).send({ error: 'csv parse failed', detail: (e as Error).message })
    }

    const report: ImportReport = { total: rows.length, matched: 0, unmatched: [] }

    await inBatches(rows, 5, async (row) => {
      let match: Awaited<ReturnType<typeof findTmdbMatch>> = null
      try {
        match = await findTmdbMatch(row.name, row.year)
      } catch (e) {
        report.unmatched.push({ name: row.name, year: row.year, reason: 'tmdb error: ' + (e as Error).message })
        return
      }
      if (!match) {
        report.unmatched.push({ name: row.name, year: row.year, reason: 'no tmdb result' })
        return
      }

      const watchedDate = row.watchedDate ?? row.date
      const watchedAt = watchedDate
        ? new Date(`${watchedDate}T12:00:00Z`)
        : undefined

      // Ensure a corresponding watched_movies row exists (the user has clearly seen it).
      await db
        .insert(watchedMovies)
        .values({
          userId,
          tmdbId: match.id,
          mediaType: 'movie',
          title: match.title,
          posterPath: match.poster_path ?? null,
        })
        .onConflictDoNothing({
          target: [watchedMovies.userId, watchedMovies.tmdbId, watchedMovies.mediaType],
        })

      await db.insert(watchHistory).values({
        userId,
        tmdbId: match.id,
        ...(watchedAt ? { watchedAt } : {}),
        myRating: letterboxdRatingTo10(row.rating),
      })
      report.matched++
    })

    return report
  })
}
