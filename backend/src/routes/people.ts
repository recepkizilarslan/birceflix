import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { uiLanguageSchema } from '../lib/locale.js'

const searchQuery = z.object({
  q: z.string().min(1).max(120),
  page: z.coerce.number().int().min(1).default(1),
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

  // Detail lookup for a single person ID. Used by the picker to rehydrate
  // chips when the URL carries IDs but the in-memory cache is empty
  // (page reload, shared link, ...). Calling /person/{id} per ID is fine
  // for the 1-3 people typically pinned in a filter.
  app.get('/api/person/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const { ui_language } = detailQuery.parse(req.query)
    const row = await tmdb<TmdbPersonRow & { id: number }>(`/person/${id}`, {
      language: ui_language,
    })
    return {
      id: row.id,
      name: row.name,
      profile_path: row.profile_path,
      known_for_department: row.known_for_department ?? null,
      known_for: '',
    }
  })
}
