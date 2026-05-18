import { useEffect, useState } from 'react'
import {
  createWebhookToken,
  deleteWebhookToken,
  listWebhookTokens,
  scrobbleUrl,
  type WebhookTokenRow,
} from '../lib/webhooks'

function fmt(iso: string | null): string {
  if (!iso) return 'henüz tetiklenmedi'
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function WebhookTokens() {
  const [rows, setRows] = useState<WebhookTokenRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  /** Freshly minted token shown ONCE so the user can copy the URL. */
  const [freshUrl, setFreshUrl] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setRows(await listWebhookTokens())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => { refresh() }, [])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    setCreating(true); setErr(null)
    try {
      const t = await createWebhookToken(label.trim())
      if (t.token) setFreshUrl(scrobbleUrl(t.token))
      setLabel('')
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  const onDelete = async (id: string, lbl: string) => {
    if (!confirm(`"${lbl}" token'ını silmek istediğine emin misin? Geri alınamaz.`)) return
    try {
      await deleteWebhookToken(id)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
        Plex veya Jellyfin'in webhook ayarına aşağıdaki URL'i koy. Tetiklendiğinde
        scrobble payload'undan TMDB ID'sini çıkarıp izleme geçmişine yazarız.
        Plex için <em>media.scrobble</em> eventi yeterli; Jellyfin için Webhook
        plugin'inde <em>PlaybackStop</em> / <em>UserDataSaved</em> / <em>MarkPlayed</em>
        seçilmeli.
      </p>

      {err && <div className="text-sm text-red-400">{err}</div>}

      {freshUrl && (
        <div className="rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/40 p-3 space-y-2">
          <div className="text-xs text-[var(--color-accent)] font-medium">
            ⚠ Bu URL yalnızca şimdi gösterilir — kopyalayıp Plex/Jellyfin'e yapıştır.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-xs break-all">
              {freshUrl}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(freshUrl)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90"
            >
              Kopyala
            </button>
          </div>
          <button
            onClick={() => setFreshUrl(null)}
            className="text-xs text-[var(--color-text-dim)] hover:text-white"
          >
            Anladım, kapat
          </button>
        </div>
      )}

      <form onSubmit={onCreate} className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[200px]">
          <span className="block text-xs text-[var(--color-text-dim)] mb-1">Etiket</span>
          <input
            type="text"
            value={label}
            maxLength={120}
            placeholder="Örn: Plex (ev)"
            onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <button
          type="submit"
          disabled={creating || !label.trim()}
          className="text-sm px-4 py-2 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90 disabled:opacity-50"
        >
          {creating ? 'Oluşturuluyor…' : 'Yeni token'}
        </button>
      </form>

      {rows == null && <div className="text-sm text-[var(--color-text-dim)]">Yükleniyor…</div>}
      {rows && rows.length === 0 && (
        <div className="text-sm text-[var(--color-text-dim)]">Henüz webhook token'ın yok.</div>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li
              key={t.id}
              className="rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{t.label}</div>
                <div className="text-xs text-[var(--color-text-dim)] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>token: …{t.token_suffix}</span>
                  <span>son tetik: {fmt(t.last_used_at)}</span>
                </div>
              </div>
              <button
                onClick={() => onDelete(t.id, t.label)}
                className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
