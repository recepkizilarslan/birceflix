import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { uiLanguageSchema } from '../lib/locale.js'

const searchQuery = z.object({
  q: z.string().min(1).max(120),
  page: z.coerce.number().int().min(1).max(500).default(1),
  ui_language: uiLanguageSchema,
})

const idParam = z.object({ id: z.coerce.number().int().positive() })
const detailQuery = z.object({ ui_language: uiLanguageSchema })

/** Trim TMDB's person row to the only fields the People picker actually
 *  renders. Keeping the response small matters because the search endpoint
 *  is called on every keystroke from the typeahead. */
interface PersonBrief {
  id: number
  name: string
  profile_path: string | null
  known_for_department: string | null
  /** Up to ~3 best-known titles, comma-joined. TMDB returns full movie/tv
   *  objects here; we just take their localized titles so the chip can
   *  show "Christopher Nolan — Inception, Interstellar, Tenet". */
  known_for: string
}

interface TmdbPersonRow {
  id: number
  name: string
  profile_path: string | null
  known_for_department?: string | null
  known_for?: Array<{ title?: string; name?: string }>
}

function condense(row: TmdbPersonRow): PersonBrief {
  const titles = (row.known_for ?? [])
    .map((k) => k.title || k.name || '')
    .filter(Boolean)
    .slice(0, 3)
    .join(', ')
  return {
    id: row.id,
    name: row.name,
    profile_path: row.profile_path,
    known_for_department: row.known_for_department ?? null,
    known_for: titles,
  }
}

export async function peopleRoutes(app: FastifyInstance) {
  // Typeahead source for the People filter. Wraps TMDB /search/person and
  // strips the response down to the fields the picker actually renders.
  app.get('/api/person/search', async (req) => {
    const { q, page, ui_language } = searchQuery.parse(req.query)
    const data = await tmdb<{ results: TmdbPersonRow[]; page: number; total_pages: number; total_results: number }>(
      '/search/person',
      {
        query: q,
        page: String(page),
        language: ui_language,
        include_adult: 'false',
      },
    )
    return {
      page: data.page,
      total_pages: data.total_pages,
      total_results: data.total_results,
      results: data.results.map(condense),
    }
  })

  // Detail lookup for a single person ID. Used by two distinct surfaces:
  //
  // 1. The People filter picker hydrating chips from the URL on reload.
  //    Only needs id/name/profile_path/department; the heavier fields are
  //    cheap to ship since the TMDB call cost is the same either way.
  //
  // 2. The PersonDetailPage. Pulls in biography, dates, and the full
  //    filmography via append_to_response so the whole page is one TMDB
  //    round-trip.
  //
  // The filmography arrays are condensed to the fields each card actually
  // renders; raw TMDB credit objects carry ~25 fields per row, most unused.
  app.get('/api/person/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const { ui_language } = detailQuery.parse(req.query)
    const detail = await tmdb<TmdbPersonDetail>(`/person/${id}`, {
      language: ui_language,
      append_to_response: 'movie_credits,tv_credits,external_ids',
    })
    return {
      id: detail.id,
      name: detail.name,
      profile_path: detail.profile_path,
      known_for_department: detail.known_for_department ?? null,
      known_for: '',
      biography: detail.biography ?? '',
      birthday: detail.birthday ?? null,
      deathday: detail.deathday ?? null,
      place_of_birth: detail.place_of_birth ?? null,
      also_known_as: detail.also_known_as ?? [],
      imdb_id: detail.external_ids?.imdb_id ?? null,
      homepage: detail.homepage ?? null,
      movie_cast: condenseMovieCredits(detail.movie_credits?.cast),
      movie_crew: condenseMovieCrew(detail.movie_credits?.crew),
      tv_cast: condenseTvCredits(detail.tv_credits?.cast),
      tv_crew: condenseTvCrew(detail.tv_credits?.crew),
    }
  })
}

interface TmdbMovieCredit {
  id: number
  title?: string
  original_title?: string
  poster_path?: string | null
  release_date?: string
  vote_average?: number
  character?: string
  job?: string
  department?: string
}

interface TmdbTvCredit {
  id: number
  name?: string
  original_name?: string
  poster_path?: string | null
  first_air_date?: string
  vote_average?: number
  character?: string
  job?: string
  department?: string
  episode_count?: number
}

interface TmdbPersonDetail {
  id: number
  name: string
  profile_path: string | null
  known_for_department?: string | null
  biography?: string
  birthday?: string | null
  deathday?: string | null
  place_of_birth?: string | null
  also_known_as?: string[]
  homepage?: string | null
  external_ids?: { imdb_id?: string | null }
  movie_credits?: { cast?: TmdbMovieCredit[]; crew?: TmdbMovieCredit[] }
  tv_credits?: { cast?: TmdbTvCredit[]; crew?: TmdbTvCredit[] }
}

function condenseMovieCredits(rows: TmdbMovieCredit[] | undefined) {
  if (!rows) return []
  return rows.map((r) => ({
    id: r.id,
    title: r.title || r.original_title || '',
    poster_path: r.poster_path ?? null,
    release_date: r.release_date || null,
    vote_average: r.vote_average ?? 0,
    character: r.character || null,
  }))
}

function condenseMovieCrew(rows: TmdbMovieCredit[] | undefined) {
  if (!rows) return []
  return rows.map((r) => ({
    id: r.id,
    title: r.title || r.original_title || '',
    poster_path: r.poster_path ?? null,
    release_date: r.release_date || null,
    vote_average: r.vote_average ?? 0,
    job: r.job || null,
    department: r.department || null,
  }))
}

function condenseTvCredits(rows: TmdbTvCredit[] | undefined) {
  if (!rows) return []
  return rows.map((r) => ({
    id: r.id,
    name: r.name || r.original_name || '',
    poster_path: r.poster_path ?? null,
    first_air_date: r.first_air_date || null,
    vote_average: r.vote_average ?? 0,
    character: r.character || null,
    episode_count: r.episode_count ?? null,
  }))
}

function condenseTvCrew(rows: TmdbTvCredit[] | undefined) {
  if (!rows) return []
  return rows.map((r) => ({
    id: r.id,
    name: r.name || r.original_name || '',
    poster_path: r.poster_path ?? null,
    first_air_date: r.first_air_date || null,
    vote_average: r.vote_average ?? 0,
    job: r.job || null,
    department: r.department || null,
    episode_count: r.episode_count ?? null,
  }))
}
