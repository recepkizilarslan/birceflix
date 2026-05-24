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
        className="h-10 px-3 sm:px-4 text-[13px] sm:text-[14px] rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-text-dim)] hover:bg-white/5 inline-flex items-center transition-all duration-200"
      >
        <span className="tabular-nums">{lang.toUpperCase()} · {region}</span>
      </button>

      {open && (
        <div className="fixed sm:absolute right-2 sm:right-0 z-50 top-14 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-auto sm:min-w-[260px] max-w-sm rounded-xl bg-[var(--color-surface)]/95 backdrop-blur-xl border border-[var(--color-border)] shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-4 space-y-4">
          <div>
            <div className="text-[13px] text-[var(--color-text-dim)] mb-2">{t('prefs.language')}</div>
            <div className="flex gap-1 rounded-lg bg-[var(--color-surface-2)] p-1">
              {(['tr', 'en'] as Lang[]).map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={`flex-1 text-[13px] px-3 py-1.5 rounded-md transition-all duration-200 border ${
                    lang === code
                      ? 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] font-medium shadow-sm'
                      : 'border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50'
                  }`}
                >
                  {code === 'tr' ? t('prefs.languageTr') : t('prefs.languageEn')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[13px] text-[var(--color-text-dim)] mb-2">{t('prefs.region')}</div>
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
            <p className="text-[11px] text-[var(--color-text-dim)] mt-2 leading-snug">
              {t('prefs.regionHint')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
