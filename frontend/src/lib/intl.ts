import { intlLocale } from '../i18n'

/** Localized country name for an ISO-3166-1 alpha-2 code. Falls back to the code. */
export function countryName(code: string): string {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([intlLocale()], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Localized language name for an ISO-639-1 code. */
export function languageName(code: string): string {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([intlLocale()], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Date formatter bound to the active i18n locale. */
export function fmtDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(intlLocale(), opts ?? { day: '2-digit', month: 'short', year: 'numeric' })
}
