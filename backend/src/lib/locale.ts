import { z } from 'zod'

/**
 * Locales the UI actually ships translations for (see frontend i18n module).
 * Constraining the wire schema to this allow-list prevents:
 *
 * - Cache-key bloat — TMDB responses get keyed in upstream caches by language,
 *   and a free-form string makes the cache surface unbounded.
 * - Silent failures — TMDB returns en-US results for unrecognised locales
 *   instead of erroring, which used to mask typos like `tr_TR` or `tr`.
 * - Header smuggling — even though TMDB doesn't dispatch on full locale
 *   strings the way HTTP does, defense-in-depth is cheap here.
 */
const SUPPORTED_UI_LANGUAGES = ['en-US', 'tr-TR', 'de-DE', 'it-IT', 'pl-PL'] as const

export const uiLanguageSchema = z
  .enum(SUPPORTED_UI_LANGUAGES)
  .default('en-US')
  .catch('en-US')

/**
 * ISO 639-1 (2-letter, lowercase) used for TMDB's `with_original_language`
 * filter. The list is "languages the user might filter by", which is
 * bigger than the UI's translated list — anything TMDB indexes is fair game.
 * We just enforce shape, not membership.
 */
export const iso639Schema = z
  .string()
  .length(2)
  .regex(/^[a-z]{2}$/, 'must be lowercase ISO 639-1')

/**
 * ISO 3166-1 alpha-2 (2-letter, uppercase) for `with_origin_country` and
 * `watch_region`. Same rationale as iso639Schema.
 */
export const iso3166Schema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'must be uppercase ISO 3166-1')
