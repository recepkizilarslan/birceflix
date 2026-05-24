import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { addToList, listLists, type ListSummary } from '../lib/lists'

interface Props {
  tmdbId: number
  /** Disambiguates TMDB namespace — movie 1396 ≠ TV 1396. Required so the
   * entry routes to the correct detail page when reopened from the list. */
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
}

/**
 * "Add to list" dropdown for the movie / TV detail pages.
 * Loads the user's lists on first open; adding emits an inline confirmation.
 */
export function AddToListMenu({ tmdbId, mediaType, title, posterPath }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [lists, setLists] = useState<ListSummary[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [addedTo, setAddedTo] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (!open || lists !== null) return
    listLists().then(setLists).catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [open, lists])

  const onPick = async (list: ListSummary) => {
    setErr(null)
    try {
      await addToList(list.id, { tmdb_id: tmdbId, media_type: mediaType, title, poster_path: posterPath })
      setAddedTo(list.name)
      window.setTimeout(() => setAddedTo(null), 2500)
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full sm:w-auto h-11 sm:h-auto sm:px-5 sm:py-2.5 px-3 rounded-lg text-sm font-medium bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition active:scale-[0.98]"
      >
        {t('addToList.button')}
      </button>

      {addedTo && (
        <div className="absolute top-full left-0 mt-1 text-xs text-[var(--color-brand)] whitespace-nowrap">
          ✓ {addedTo}
        </div>
      )}

      {open && (
        <div className="absolute z-20 top-full left-0 mt-2 min-w-[260px] max-h-80 overflow-y-auto rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl">
          {err && <div className="text-sm text-red-400 px-3 py-2">{err}</div>}
          {lists == null && <div className="text-sm text-[var(--color-text-dim)] px-3 py-2">{t('addToList.loading')}</div>}
          {lists && lists.length === 0 && (
            <div className="px-3 py-3 text-sm text-[var(--color-text-dim)] leading-relaxed">
              {t('addToList.emptyMessage')}{' '}
              <Link to="/lists" className="text-[var(--color-accent)] hover:underline">{t('addToList.createLink')}</Link>.
            </div>
          )}
          {lists && lists.map((l) => (
            <button
              key={l.id}
              onClick={() => onPick(l)}
              className="block w-full text-left px-3 py-2 hover:bg-[var(--color-surface-2)] transition border-b border-[var(--color-border)] last:border-b-0"
            >
              <div className="text-sm font-medium truncate">{l.name}</div>
              <div className="text-xs text-[var(--color-text-dim)]">
                {t('addToList.filmCount', { count: l.item_count ?? 0 })}{l.is_public ? ` · ${t('lists.publicBadge')}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
