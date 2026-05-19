import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  /** Optional controlled value. When provided, the input mirrors it so shared
   *  URLs and back/forward navigation populate the field. The user can still
   *  type freely; the parent re-syncs only when `value` itself changes. */
  value?: string
  onSearch: (q: string) => void
  onClear: () => void
}

export function SearchBar({ value, onSearch, onClear }: Props) {
  const { t } = useTranslation()
  const [q, setQ] = useState(value ?? '')

  // Resync local input when the external value changes (e.g., user navigates
  // back to a different `?q=`, or clicks a shared link). We don't strictly
  // control the input so the user's in-progress typing isn't clobbered by
  // an unrelated re-render.
  useEffect(() => {
    if (value !== undefined) setQ(value)
  }, [value])

  const clear = () => { setQ(''); onClear() }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = q.trim()
        if (v) onSearch(v)
        else onClear()
      }}
      role="search"
      className="relative flex items-center"
    >
      {/* Magnifier prefix — taps the input when clicked. */}
      <span className="absolute left-3.5 inline-flex pointer-events-none text-[var(--color-text-dim)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('search.placeholder')}
        enterKeyHint="search"
        aria-label={t('search.placeholder')}
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl h-12 sm:h-11 pl-11 pr-[5.5rem] focus:outline-none focus:border-[var(--color-accent)]"
      />
      <div className="absolute right-1.5 flex items-center gap-1">
        {q && (
          <button
            type="button"
            onClick={clear}
            aria-label={t('search.clear')}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[var(--color-text-dim)] hover:text-white hover:bg-[var(--color-surface-2)]"
          >
            ✕
          </button>
        )}
        <button
          type="submit"
          aria-label={t('search.placeholder')}
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-black hover:opacity-90 active:scale-[0.96]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <line x1="20" y1="20" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>
    </form>
  )
}
