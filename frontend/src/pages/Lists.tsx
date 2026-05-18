import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { createList, listLists, type ListSummary } from '../lib/lists'

export function ListsPage() {
  const { t } = useTranslation()
  const { user } = useOutletContext<LayoutContext>()
  const [rows, setRows] = useState<ListSummary[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      setRows(await listLists())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    if (!user) return
    refresh()
  }, [user])

  if (!user) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
        <div className="text-lg mb-2">{t('lists.signInPrompt')}</div>
        <div className="text-sm text-[var(--color-text-dim)]">{t('auth.signInHint')}</div>
      </div>
    )
  }

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true); setErr(null)
    try {
      await createList({ name: newName.trim() })
      setNewName(''); setCreating(false)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('lists.title')}</h1>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90"
          >
            {t('lists.newList')}
          </button>
        )}
      </header>

      {creating && (
        <form onSubmit={onCreate} className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-3">
          <label className="block">
            <span className="text-xs text-[var(--color-text-dim)]">{t('lists.listName')}</span>
            <input
              type="text"
              value={newName}
              autoFocus
              maxLength={200}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('lists.listNamePlaceholder')}
              className="mt-1 w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="text-sm px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t('lists.creating') : t('lists.create')}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName(''); setErr(null) }}
              className="text-sm px-4 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {err && <div className="text-sm text-red-400">{err}</div>}

      {rows == null && <div className="text-sm text-[var(--color-text-dim)]">{t('lists.loading')}</div>}
      {rows && rows.length === 0 && !creating && (
        <div className="text-sm text-[var(--color-text-dim)]">
          {t('lists.empty')}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((l) => (
            <Link
              key={l.id}
              to={`/lists/${l.id}`}
              className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] p-4 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium leading-snug">{l.name}</h3>
                {l.is_public && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/40">
                    {t('lists.publicBadge')}
                  </span>
                )}
              </div>
              {l.description && (
                <p className="text-xs text-[var(--color-text-dim)] mt-1 line-clamp-2">{l.description}</p>
              )}
              <div className="text-xs text-[var(--color-text-dim)] mt-2">
                {t('lists.filmCount', { count: l.item_count ?? 0 })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
