import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tmdb } from '../lib/tmdb.js'
import { omdbByImdbId } from '../lib/omdb.js'
import { uiLanguageSchema } from '../lib/locale.js'
import { env } from '../env.js'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })
const querySchema = z.object({
  region: z.string().length(2).default(env.DEFAULT_WATCH_REGION),
  ui_language: uiLanguageSchema,
})

interface TmdbDetail {
  id: number
  imdb_id?: string
  runtime?: number
  [key: string]: unknown
}

interface TmdbTranslationRow {
  iso_639_1: string
  iso_3166_1: string
  name: string
  english_name: string
  data?: { title?: string; overview?: string; tagline?: string }
}

export interface TranslatedLanguage {
  iso_639_1: string
  english_name: string
  name: string
}

// TMDB ships ~40 locale variants per title, most with empty data.
// Keep only languages where at least one locale actually translated
// the title/overview/tagline, deduped on iso_639_1.
function pickTranslatedLanguages(detail: TmdbDetail): TranslatedLanguage[] {
  const bag = (detail as { translations?: { translations?: TmdbTranslationRow[] } }).translations
  const rows = bag?.translations
  if (!rows) return []
  const seen = new Map<string, TranslatedLanguage>()
  for (const r of rows) {
    const hasContent = !!(r.data?.title || r.data?.overview || r.data?.tagline)
    if (!hasContent) continue
    if (seen.has(r.iso_639_1)) continue
    seen.set(r.iso_639_1, { iso_639_1: r.iso_639_1, english_name: r.english_name, name: r.name })
  }
  return [...seen.values()].sort((a, b) => a.english_name.localeCompare(b.english_name))
}

export async function movieRoutes(app: FastifyInstance) {
  app.get('/api/movie/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params)
    const { region, ui_language } = querySchema.parse(req.query)

    const detail = await tmdb<TmdbDetail>(`/movie/${id}`, {
      language: ui_language,
      append_to_response: 'credits,videos,reviews,watch/providers,translations',
    })

    // OMDb enrichment — only on detail page (1000/day budget)
    let omdb: Record<string, unknown> | null = null
    let awards: string | null = null
    let imdbRating: string | null = null
    if (detail.imdb_id) {
      omdb = await omdbByImdbId(detail.imdb_id).catch(() => null)
      if (omdb) {
        const a = omdb.Awards
        awards = typeof a === 'string' && a !== 'N/A' ? a : null
        const r = omdb.imdbRating
        imdbRating = typeof r === 'string' && r !== 'N/A' ? r : null
      }
    }

    // Pull region-specific providers out of the bag if present
    const providers = (detail as { 'watch/providers'?: { results?: Record<string, unknown> } })['watch/providers']
    const watchProviders = providers?.results?.[region] ?? null

    const translatedLanguages = pickTranslatedLanguages(detail)
    // Drop the raw translations bag from the response — frontend only
    // needs the compact language list, not the full title/overview payload.
    const { translations: _drop, ...rest } = detail as TmdbDetail & { translations?: unknown }
    void _drop

    void reply
    return {
      ...rest,
      omdb,
      awards,
      imdb_rating: imdbRating,
      watch_providers: watchProviders,
      translated_languages: translatedLanguages,
    }
  })
}
