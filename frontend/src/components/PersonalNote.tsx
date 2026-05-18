import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getWatched, updateWatchedMeta } from '../lib/watched'

interface Props {
  /** TMDB movie id */
  tmdbId: number
  /** Whether the user has marked this movie as watched (drives mount state) */
  watched: boolean
}

type Saving = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Personal rating + notes panel for a watched movie.
 * Auto-saves with a 600ms debounce.
 */
export function PersonalNote({ tmdbId, watched }: Props) {
  const { t } = useTranslation()
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState<string>('')
  const [hover, setHover] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState<Saving>('idle')
  const saveTimer = useRef<number | null>(null)
  const dirty = useRef(false)

  useEffect(() => {
    if (!watched) { setLoaded(false); return }
    let mounted = true
    setLoaded(false)
    getWatched(tmdbId)
      .then((row) => {
        if (!mounted) return
        setRating(row?.my_rating ?? null)
        setNotes(row?.notes ?? '')
        setLoaded(true)
      })
      .catch(() => { if (mounted) setLoaded(true) })
    return () => { mounted = false }
  }, [tmdbId, watched])

  useEffect(() => {
    if (!loaded || !dirty.current) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      setSaving('saving')
      try {
        await updateWatchedMeta(tmdbId, { my_rating: rating, notes: notes || null })
        setSaving('saved')
        window.setTimeout(() => setSaving((s) => (s === 'saved' ? 'idle' : s)), 1500)
      } catch {
        setSaving('error')
      }
    }, 600)
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }
  }, [rating, notes, tmdbId, loaded])

  if (!watched) {
    return (
      <div className="text-sm text-[var(--color-text-dim)]">
        {t('personalNote.markFirst')}
      </div>
    )
  }

  if (!loaded) {
    return <div className="text-sm text-[var(--color-text-dim)]">{t('common.loading')}</div>
  }

  const onPick = (n: number) => {
    dirty.current = true
    setRating((cur) => (cur === n ? null : n))
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-[var(--color-text-dim)]">{t('personalNote.yourRating')}</span>
          <span className="text-xs tabular-nums text-[var(--color-text-dim)]">
            {(hover ?? rating) != null ? `${hover ?? rating}/10` : '—'}
          </span>
        </div>
        <div className="flex gap-1" onMouseLeave={() => setHover(null)}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = (hover ?? rating ?? 0) >= n
            return (
              <button
                key={n}
                type="button"
                aria-label={t('personalNote.ratePoint', { n })}
                onMouseEnter={() => setHover(n)}
                onClick={() => onPick(n)}
                className={`h-7 flex-1 rounded transition ${
                  active
                    ? 'bg-[var(--color-accent)]'
                    : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-border)]'
                }`}
              />
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-dim)] mb-1.5" htmlFor="my-note">
          {t('personalNote.yourNotes')}
        </label>
        <textarea
          id="my-note"
          value={notes}
          maxLength={2000}
          rows={4}
          placeholder={t('personalNote.notesPlaceholder')}
          onChange={(e) => { dirty.current = true; setNotes(e.target.value) }}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)] resize-y"
        />
        <div className="flex items-center justify-between mt-1 text-[10px] text-[var(--color-text-dim)]">
          <span>
            {saving === 'saving' && t('common.saving')}
            {saving === 'saved' && t('common.saved')}
            {saving === 'error' && <span className="text-red-400">{t('common.savingFailed')}</span>}
            {saving === 'idle' && <span>&nbsp;</span>}
          </span>
          <span className="tabular-nums">{notes.length}/2000</span>
        </div>
      </div>
    </div>
  )
}
