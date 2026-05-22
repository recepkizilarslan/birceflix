import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getPublicList, type ListWithItems } from '../lib/lists'
import { poster } from '../lib/api'

export function PublicListPage() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [list, setList] = useState<ListWithItems | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setList(null); setErr(null)
    getPublicList(slug).then(setList).catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [slug])

  if (err) return <div className="text-red-400">{err}</div>
  if (!list) return <div className="py-16 text-center text-[var(--color-text-dim)]">{t('common.loading')}</div>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{list.name}</h1>
        {list.owner_name && (
          <div className="text-sm text-[var(--color-text-dim)] mt-1">{t('lists.byOwner', { owner: list.owner_name })}</div>
        )}
        {list.description && (
          <p className="text-sm text-[var(--color-text-dim)] mt-3 leading-relaxed">{list.description}</p>
        )}
        <div className="text-xs text-[var(--color-text-dim)] mt-2">{t('lists.filmCount', { count: list.items.length })}</div>
      </header>

      {list.items.length === 0 ? (
        <div className="text-sm text-[var(--color-text-dim)]">{t('lists.publicEmpty')}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
          {list.items.map((it) => (
            <button
              key={`${it.media_type}:${it.tmdb_id}`}
              onClick={() => navigate(it.media_type === 'tv' ? `/tv/${it.tmdb_id}` : `/movie/${it.tmdb_id}`)}
              className="group rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition text-left"
            >
              <div className="aspect-[2/3] bg-[var(--color-surface-2)] overflow-hidden">
                {poster(it.poster_path) ? (
                  <img
                    src={poster(it.poster_path)!}
                    alt={it.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-dim)]">
                    {t('card.noPoster')}
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium leading-snug line-clamp-2">{it.title}</h3>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
