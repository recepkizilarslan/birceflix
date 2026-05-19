import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { imdbTop, type ImdbTopSnapshot } from '../lib/api'
import { useRegion } from '../lib/preferences'
import { DiscoverCard, type DiscoverCardItem } from '../components/DiscoverCard'
import { mediaKey } from '../lib/watched'

/** How many cards to render per "page" client-side. Backend ships all 200 in
 * one shot (already cached), but we paginate the DOM to keep mobile scroll
 * snappy. 50 lands roughly two scroll-screens on desktop. */
const PAGE_SIZE = 50

export function ImdbTopPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [region] = useRegion()
  const { user, watchedKeys, toggleWatched, watchlistKeys, toggleWatchlist } =
    useOutletContext<LayoutContext>()

  const [data, setData] = useState<ImdbTopSnapshot | null>(null)
  const [updatedHours, setUpdatedHours] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    setError(null)
    imdbTop(region)
      .then((snap) => {
        setData(snap)
        // Capture freshness when data lands rather than during render — keeps
        // the render pure (react-hooks/purity) and is plenty accurate since
        // the cache only refreshes once a day anyway.
        setUpdatedHours(
          Math.max(1, Math.round((Date.now() - new Date(snap.updated_at).getTime()) / 3_600_000)),
        )
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
    setPage(1)
  }, [region])

  const totalPages = data ? Math.max(1, Math.ceil(data.movies.length / PAGE_SIZE)) : 1
  const pageItems = useMemo(() => {
    if (!data) return []
    const start = (page - 1) * PAGE_SIZE
    return data.movies.slice(start, start + PAGE_SIZE)
  }, [data, page])

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{t('imdbTop.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-dim)] mt-0.5">
            {t('imdbTop.subtitle', { region })}
          </p>
        </div>
        {updatedHours != null && (
          <div className="text-[11px] sm:text-xs text-[var(--color-text-dim)]">
            {t('imdbTop.updatedHoursAgo', { hours: updatedHours })}
          </div>
        )}
      </header>

      {loading && !data && (
        <div className="py-12 text-center text-[var(--color-text-dim)]">{t('common.loading')}</div>
      )}

      {error && !data && (
        <div className="py-12 text-center text-red-400">
          {t('imdbTop.loadFailed')} <span className="text-[var(--color-text-dim)]">({error})</span>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-4">
            {pageItems.map((m) => {
              const item: DiscoverCardItem = {
                id: m.id,
                media_type: 'movie',
                title: m.title,
                poster_path: m.poster_path,
                vote_average: m.vote_average,
                date: m.year ? `${m.year}-01-01` : null,
                meta: <span className="font-semibold text-[var(--color-text)]">#{m.rank}</span>,
              }
              const k = mediaKey(item.media_type, item.id)
              return (
                <DiscoverCard
                  key={item.id}
                  item={item}
                  onOpen={(it) => navigate(`/movie/${it.id}`)}
                  onToggleWatched={user ? toggleWatched : null}
                  watched={watchedKeys.has(k)}
                  onToggleWatchlist={user ? toggleWatchlist : null}
                  inWatchlist={watchlistKeys.has(k)}
                  providerBanner={m.providers}
                />
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-6">
              <button
                disabled={page <= 1}
                onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0 }) }}
                className="px-3 py-1.5 rounded-md text-sm bg-[var(--color-surface)] border border-[var(--color-border)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-surface-2)]"
              >
                {t('common.previous')}
              </button>
              <div className="text-sm text-[var(--color-text-dim)]">
                {t('common.pageOf', { page, total: totalPages })}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0 }) }}
                className="px-3 py-1.5 rounded-md text-sm bg-[var(--color-surface)] border border-[var(--color-border)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-surface-2)]"
              >
                {t('common.next')}
              </button>
            </div>
          )}

          <p className="text-[11px] text-[var(--color-text-dim)] text-center pb-4">
            {t('imdbTop.attribution', { source: data.source.name })}
          </p>
        </>
      )}
    </div>
  )
}
