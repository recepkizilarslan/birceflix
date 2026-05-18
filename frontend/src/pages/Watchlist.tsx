import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { DiscoverCard, type DiscoverCardItem } from '../components/DiscoverCard'
import { mediaKey } from '../lib/watched'

export function Watchlist() {
  const { t } = useTranslation()
  const { user, watchlistRows, watchedKeys, watchlistKeys, toggleWatched, toggleWatchlist } = useOutletContext<LayoutContext>()
  const navigate = useNavigate()

  if (!user) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
        <div className="text-lg mb-2">{t('watchlist.signInPrompt')}</div>
      </div>
    )
  }

  if (watchlistRows.length === 0) {
    return (
      <div className="text-center text-[var(--color-text-dim)] py-10">
        {t('watchlist.empty')}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
      {watchlistRows.map((r) => {
        const item: DiscoverCardItem = {
          id: r.tmdb_id,
          media_type: r.media_type,
          title: r.title,
          poster_path: r.poster_path,
          vote_average: 0,
          date: r.added_at.slice(0, 10),
        }
        const k = mediaKey(item.media_type, item.id)
        return (
          <DiscoverCard
            key={k}
            item={item}
            onOpen={(it) => navigate(it.media_type === 'tv' ? `/tv/${it.id}` : `/movie/${it.id}`)}
            onToggleWatched={toggleWatched}
            watched={watchedKeys.has(k)}
            onToggleWatchlist={toggleWatchlist}
            inWatchlist={watchlistKeys.has(k)}
          />
        )
      })}
    </div>
  )
}
