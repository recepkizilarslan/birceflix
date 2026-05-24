import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getPerson, searchPerson, type Person } from '../lib/api'

interface Props {
  /** Selected TMDB person IDs. The picker only knows the IDs; it fetches
   *  display data (name, photo) into its own cache so a URL-only state
   *  still produces meaningful chips after a page reload. */
  value: number[]
  onChange: (next: number[]) => void
}

/**
 * Debounced search-as-you-type picker for TMDB people.
 *
 * The picker keeps a Map<id, Person> in component state so a chip can keep
 * rendering name + photo without re-hitting the API on every render. When
 * `value` lists an ID we don't have details for (page reload, URL load),
 * we fan out one /api/person/:id request per missing ID to fill the cache.
 *
 * Results are TMDB's full /search/person hits trimmed to the fields we
 * actually render; ranking is TMDB's own (popularity-weighted name match),
 * which puts the obvious person first for queries like "Nolan" or "DiCaprio".
 */
export function PeoplePicker({ value, onChange }: Props) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [cache, setCache] = useState<Map<number, Person>>(new Map())
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Debounced search: 250ms after the user stops typing. Empty query hides
  // the dropdown and clears the result list so a stale search doesn't
  // briefly flash next time the field is focused.
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    const tid = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchPerson(query.trim(), 1)
        setResults(data.results)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(tid)
  }, [query])

  // Rehydrate chips for IDs we don't have details for yet. Runs whenever
  // `value` gains IDs that aren't in the cache — fresh URL load typically,
  // but also after applying a saved filter.
  useEffect(() => {
    const missing = value.filter((id) => !cache.has(id))
    if (missing.length === 0) return
    let cancelled = false
    Promise.all(missing.map((id) => getPerson(id).catch(() => null))).then((rows) => {
      if (cancelled) return
      setCache((prev) => {
        const next = new Map(prev)
        for (const r of rows) {
          if (r) next.set(r.id, r)
        }
        return next
      })
    })
    return () => { cancelled = true }
  }, [value, cache])

  // Close dropdown on outside click. Keeping the listener mounted always
  // (rather than only while open) keeps the dropdown closing reliably
  // even when the trigger element is re-rendered.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const add = (p: Person) => {
    if (value.includes(p.id)) {
      setQuery('')
      return
    }
    setCache((prev) => new Map(prev).set(p.id, p))
    onChange([...value, p.id])
    setQuery('')
    setResults([])
  }

  const remove = (id: number) => {
    onChange(value.filter((x) => x !== id))
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={t('filters.peoplePlaceholder')}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
        {open && (query.trim().length > 0 || loading) && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-72 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
            {loading && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-[var(--color-text-dim)]">{t('filters.peopleLoading')}</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-[var(--color-text-dim)]">{t('filters.peopleNoResults')}</div>
            )}
            {results.slice(0, 12).map((p) => {
              const already = value.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p)}
                  disabled={already}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-2)] transition border-b border-[var(--color-border)] last:border-b-0 ${already ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--color-surface-2)] shrink-0">
                    {p.profile_path && (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${p.profile_path}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    {(p.known_for || p.known_for_department) && (
                      <div className="text-[11px] text-[var(--color-text-dim)] truncate">
                        {p.known_for || p.known_for_department}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const p = cache.get(id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs"
              >
                <span className="w-5 h-5 rounded-full overflow-hidden bg-[var(--color-surface)] shrink-0">
                  {p?.profile_path && (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${p.profile_path}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </span>
                <span className="truncate max-w-[160px]">{p?.name ?? `#${id}`}</span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label={t('filters.peopleRemove')}
                  className="ml-0.5 text-[var(--color-text-dim)] hover:text-[var(--color-accent)]"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
