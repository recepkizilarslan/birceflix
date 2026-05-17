/**
 * Letterboxd CSV import helpers.
 *
 * Letterboxd exports a zip containing several CSVs. We support two:
 *
 * - watched.csv — one row per movie ever watched.
 *     columns: Date, Name, Year, Letterboxd URI
 *
 * - diary.csv — one row per dated viewing event (rewatches included).
 *     columns: Date, Name, Year, Letterboxd URI, Rating,
 *              Rewatch, Tags, Watched Date
 *
 * Each row only carries title + year + (optional) Letterboxd URI — there
 * is NO TMDB id in the export. We resolve the TMDB id via
 * /search/movie?query=...&year=...&primary_release_year=...; the first
 * result is taken. Rare false matches are an accepted trade-off.
 */
import { parse } from 'csv-parse/sync'
import { tmdb } from './tmdb.js'

export interface LetterboxdWatchedRow {
  date: string
  name: string
  year: number | null
  uri: string | null
}

export interface LetterboxdDiaryRow extends LetterboxdWatchedRow {
  rating: number | null      // Letterboxd: 0.5 .. 5.0 (half-star steps)
  rewatch: boolean
  tags: string[]
  watchedDate: string | null // ISO date (YYYY-MM-DD)
}

export function parseLetterboxdWatched(csv: string): LetterboxdWatchedRow[] {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[]
  return records.map((r) => ({
    date: r.Date ?? '',
    name: r.Name ?? '',
    year: toInt(r.Year),
    uri: r['Letterboxd URI'] ?? null,
  })).filter((r) => r.name)
}

export function parseLetterboxdDiary(csv: string): LetterboxdDiaryRow[] {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[]
  return records.map((r) => ({
    date: r.Date ?? '',
    name: r.Name ?? '',
    year: toInt(r.Year),
    uri: r['Letterboxd URI'] ?? null,
    rating: r.Rating ? parseFloat(r.Rating) : null,
    rewatch: (r.Rewatch ?? '').toLowerCase() === 'yes',
    tags: (r.Tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    watchedDate: r['Watched Date'] || null,
  })).filter((r) => r.name)
}

/**
 * Convert Letterboxd rating (0.5..5.0, half-star) to our 1..10 scale.
 * 0.5 → 1, 1.0 → 2, ..., 5.0 → 10.
 */
export function letterboxdRatingTo10(stars: number | null): number | null {
  if (stars == null || Number.isNaN(stars)) return null
  const v = Math.round(stars * 2)
  if (v < 1 || v > 10) return null
  return v
}

interface TmdbSearchResult {
  results: Array<{
    id: number
    title: string
    release_date?: string
    poster_path: string | null
  }>
}

/** Find the best-matching TMDB movie for a Letterboxd row. Returns null on no match. */
export async function findTmdbMatch(name: string, year: number | null) {
  const params: Record<string, string | undefined> = { query: name, include_adult: 'false' }
  if (year) {
    params.primary_release_year = String(year)
    params.year = String(year)
  }
  const data = await tmdb<TmdbSearchResult>('/search/movie', params)
  return data.results[0] ?? null
}

function toInt(s: string | undefined): number | null {
  if (!s) return null
  const n = parseInt(s, 10)
  return Number.isNaN(n) ? null : n
}
