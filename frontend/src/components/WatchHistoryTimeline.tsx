import { useEffect, useState } from 'react'
import { addHistory, deleteHistory, listHistory, type WatchHistoryEntry } from '../lib/history'

interface Props {
  tmdbId: number
}

function todayISODate(): string {
  // Local-date string (YYYY-MM-DD) suitable for <input type="date">
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function WatchHistoryTimeline({ tmdbId }: Props) {
  const [rows, setRows] = useState<WatchHistoryEntry[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // form state
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<string>(todayISODate())
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    try {
      setRows(await listHistory(tmdbId))
    } catch (e: any) {
      setErr(e.message ?? 'yüklenemedi')
    }
  }

  useEffect(() => { setRows(null); setErr(null); refresh() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [tmdbId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setErr(null)
    try {
      await addHistory({
        tmdb_id: tmdbId,
        watched_at: date,
        location: location.trim() || null,
        notes: notes.trim() || null,
      })
      setLocation(''); setNotes(''); setDate(todayISODate()); setOpen(false)
      await refresh()
    } catch (e: any) {
      setErr(e.message ?? 'kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Bu izleme kaydını silmek istediğine emin misin?')) return
    try {
      await deleteHistory(id)
      await refresh()
    } catch (e: any) {
      setErr(e.message ?? 'silinemedi')
    }
  }

  if (rows == null) return <div className="text-sm text-[var(--color-text-dim)]">Yükleniyor…</div>

  return (
    <div className="space-y-3">
      {err && <div className="text-sm text-red-400">{err}</div>}

      {rows.length === 0 && !open && (
        <div className="text-sm text-[var(--color-text-dim)]">
          Henüz tarihli bir izleme eklemedin.
        </div>
      )}

      {rows.length > 0 && (
        <ol className="relative space-y-3 border-l border-[var(--color-border)] pl-4">
          {rows.map((r) => (
            <li key={r.id} className="relative">
              <span className="absolute -left-[21px] top-2 w-3 h-3 rounded-full bg-[var(--color-accent)] border-2 border-[var(--color-bg)]" />
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium tabular-nums">{fmtDate(r.watched_at)}</div>
                  <button
                    onClick={() => remove(r.id)}
                    className="text-xs text-[var(--color-text-dim)] hover:text-red-400"
                    aria-label="Sil"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--color-text-dim)]">
                  {r.location && <span className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">📍 {r.location}</span>}
                  {r.my_rating != null && <span className="px-2 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/40">★ {r.my_rating}/10</span>}
                </div>
                {r.notes && <div className="mt-2 text-sm leading-relaxed whitespace-pre-line">{r.notes}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
        >
          + İzleme ekle
        </button>
      )}

      {open && (
        <form onSubmit={submit} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex flex-col text-xs text-[var(--color-text-dim)] gap-1">
              Tarih
              <input
                type="date"
                value={date}
                max={todayISODate()}
                onChange={(e) => setDate(e.target.value)}
                required
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <label className="flex flex-col text-xs text-[var(--color-text-dim)] gap-1">
              Nerede (opsiyonel)
              <input
                type="text"
                value={location}
                placeholder="ev, sinema, uçak…"
                maxLength={120}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              />
            </label>
          </div>
          <label className="flex flex-col text-xs text-[var(--color-text-dim)] gap-1">
            Not (opsiyonel)
            <textarea
              rows={2}
              value={notes}
              maxLength={2000}
              placeholder="o izlemeyle ilgili kısa not…"
              onChange={(e) => setNotes(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)] resize-y"
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setErr(null) }}
              className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
            >
              İptal
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
