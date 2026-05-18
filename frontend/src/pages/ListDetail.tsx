import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import type { LayoutContext } from '../Layout'
import { MovieCard } from '../components/MovieCard'
import { deleteList, getList, removeFromList, updateList, type ListWithItems } from '../lib/lists'
import type { TmdbMovie } from '../lib/api'

export function ListDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, watchedIds, toggleWatched } = useOutletContext<LayoutContext>()

  const [list, setList] = useState<ListWithItems | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    if (!id) return
    try {
      const data = await getList(id)
      setList(data)
      setName(data.name)
      setDesc(data.description ?? '')
      setIsPublic(data.is_public)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => { if (user) refresh() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [id, user])

  if (!user) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
        <div className="text-lg mb-2">Bu listeyi görmek için giriş yap</div>
        <div className="text-sm text-[var(--color-text-dim)]">Sağ üstten Google ile giriş yapabilirsin.</div>
      </div>
    )
  }

  if (err) return <div className="text-red-400">{err}</div>
  if (!list) return <div className="py-16 text-center text-[var(--color-text-dim)]">Yükleniyor…</div>

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await updateList(list.id, {
        name,
        description: desc.trim() || null,
        is_public: isPublic,
      })
      setEditing(false)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!confirm(`"${list.name}" listesini silmek istediğine emin misin?`)) return
    try {
      await deleteList(list.id)
      navigate('/lists')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const onRemoveItem = async (tmdbId: number) => {
    try {
      await removeFromList(list.id, tmdbId)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const shareUrl = list.public_slug
    ? `${window.location.origin}/public/lists/${list.public_slug}`
    : null

  const cards: TmdbMovie[] = list.items.map((it) => ({
    id: it.tmdb_id,
    title: it.title,
    original_title: it.title,
    original_language: '',
    overview: '',
    poster_path: it.poster_path,
    backdrop_path: null,
    release_date: it.added_at.slice(0, 10),
    vote_average: 0,
    vote_count: 0,
  }))

  return (
    <div className="space-y-6">
      <header>
        <button
          onClick={() => navigate('/lists')}
          className="text-sm text-[var(--color-text-dim)] hover:text-white mb-3"
        >
          ← Listelerime dön
        </button>
        {!editing ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">{list.name}</h1>
              {list.description && (
                <p className="text-sm text-[var(--color-text-dim)] mt-2 leading-relaxed">{list.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3 text-xs text-[var(--color-text-dim)]">
                <span>{list.items.length} film</span>
                {list.is_public && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/40">
                    public
                  </span>
                )}
              </div>
              {shareUrl && (
                <div className="mt-2 text-xs flex items-center gap-2">
                  <code className="px-2 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] break-all">
                    {shareUrl}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(shareUrl)}
                    className="text-[var(--color-accent)] hover:underline"
                  >
                    kopyala
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
              >
                Düzenle
              </button>
              <button
                onClick={onDelete}
                className="text-sm px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20"
              >
                Sil
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSave} className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-3">
            <label className="block">
              <span className="text-xs text-[var(--color-text-dim)]">İsim</span>
              <input
                type="text"
                value={name}
                maxLength={200}
                required
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-dim)]">Açıklama</span>
              <textarea
                value={desc}
                rows={3}
                maxLength={2000}
                onChange={(e) => setDesc(e.target.value)}
                className="mt-1 w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)] resize-y"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              <span>Public yap (paylaşılabilir bir bağlantı oluşur)</span>
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="text-sm px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setErr(null); refresh() }}
                className="text-sm px-4 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
              >
                İptal
              </button>
            </div>
          </form>
        )}
      </header>

      {cards.length === 0 ? (
        <div className="text-sm text-[var(--color-text-dim)]">
          Bu listede henüz film yok. Bir filmin detay sayfasında "+ Listeye ekle" diyebilirsin.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
          {cards.map((m) => (
            <div key={m.id} className="relative group">
              <MovieCard
                movie={m}
                watched={watchedIds.has(m.id)}
                canMark={!!user}
                onToggleWatched={toggleWatched}
                onOpen={(mv) => navigate(`/movie/${mv.id}`)}
              />
              <button
                onClick={() => onRemoveItem(m.id)}
                className="absolute top-2 right-2 hidden group-hover:flex items-center justify-center w-7 h-7 rounded-full bg-black/70 text-white hover:bg-red-500/80 text-sm"
                title="Listeden çıkar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
