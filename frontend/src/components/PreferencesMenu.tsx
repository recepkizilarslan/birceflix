import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COUNTRIES } from '../lib/constants'
import { countryName } from '../lib/intl'
import { useLanguage, useRegion, type Lang } from '../lib/preferences'

/**
 * Header dropdown for language + region preferences.
 * Click-outside closes the menu; both selections persist to localStorage
 * (handled in lib/preferences).
 */
export function PreferencesMenu({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const [lang, setLang] = useLanguage()
  const [region, setRegion] = useRegion()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const regions = COUNTRIES.filter((c) => c.code)

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('prefs.open')}
        title={t('prefs.title')}
        className="h-9 px-2.5 text-xs sm:text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] inline-flex items-center"
      >
        <span className="tabular-nums">{lang.toUpperCase()} · {region}</span>
      </button>

      {open && (
        <div className="fixed sm:absolute right-2 sm:right-0 z-50 top-14 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-auto sm:min-w-[240px] max-w-sm rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl p-3 space-y-3">
          <div>
            <div className="text-xs text-[var(--color-text-dim)] mb-1.5">{t('prefs.language')}</div>
            <div className="flex gap-1 rounded-lg bg-[var(--color-surface-2)] p-1">
              {(['tr', 'en'] as Lang[]).map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={`flex-1 text-xs px-2 py-1 rounded-md transition ${
                    lang === code
                      ? 'bg-[var(--color-accent)] text-black font-medium'
                      : 'text-[var(--color-text-dim)] hover:text-white'
                  }`}
                >
                  {code === 'tr' ? t('prefs.languageTr') : t('prefs.languageEn')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-[var(--color-text-dim)] mb-1.5">{t('prefs.region')}</div>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            >
              {regions.map((c) => (
                <option key={c.code} value={c.code}>
                  {countryName(c.code)} ({c.code})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--color-text-dim)] mt-1.5 leading-snug">
              {t('prefs.regionHint')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
