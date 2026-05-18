import { useTranslation } from 'react-i18next'
import { poster } from '../lib/api'
import type { MediaType } from '../lib/watched'

/**
 * Card item shape — accepts either a TmdbMovie or TmdbTvShow normalised to
 * a small common surface. We don't take the union of those interfaces here
 * because the parent already knows which media type it's rendering.
 */
export interface DiscoverCardItem {
  id: number
  media_type: MediaType
  /** Movie's `title` or TV's `name`. */
  title: string
  poster_path: string | null
  /** TMDB ★ rating (0-10). */
  vote_average: number
  /** Movie's `release_date` or TV's `first_air_date` — only the year is shown. */
  date: string | null
  /** Optional secondary line — e.g. "2 sezon · 16 bölüm" on TV. */
  meta?: React.ReactNode
}

interface Props {
  item: DiscoverCardItem
  onOpen: (item: DiscoverCardItem) => void
  /** Watched toggle. Hidden when null (e.g. for the unauthed shell, though
   *  we now gate the whole app). */
  onToggleWatched: ((item: DiscoverCardItem) => void) | null
  watched: boolean
  /** Watchlist toggle. Hidden when null. */
  onToggleWatchlist: ((item: DiscoverCardItem) => void) | null
  inWatchlist: boolean
  /** When set, shown as a corner badge — used on the Watched page. */
  myRating?: number | null
}

/**
 * One card on the discover grid. Generic over movie vs TV so a single
 * component renders both with identical action affordances (watched +
 * watchlist toggles). Visual baseline is the original MovieCard.
 */
export function DiscoverCard({
  item,
  onOpen,
  onToggleWatched,
  watched,
  onToggleWatchlist,
  inWatchlist,
  myRating,
}: Props) {
  const { t } = useTranslation()
  const year = item.date?.slice(0, 4) ?? ''

  return (
    <div className="group rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition flex flex-col">
      <button onClick={() => onOpen(item)} className="block w-full text-left">
        <div className="relative aspect-[2/3] bg-[var(--color-surface-2)] overflow-hidden">
          {poster(item.poster_path) ? (
            <img
              src={poster(item.poster_path)!}
              alt={item.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-dim)]">
              {t('card.noPoster')}
            </div>
          )}
          {myRating != null && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[var(--color-accent)] text-black text-xs font-semibold shadow">
              ★ {myRating}
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium leading-snug line-clamp-2">{item.title}</h3>
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              ★ {item.vote_average.toFixed(1)}
            </span>
          </div>
          <div className="text-xs text-[var(--color-text-dim)] mt-1 flex flex-wrap items-center gap-x-1.5">
            {year && <span>{year}</span>}
            {item.meta && <>{year && <span>·</span>}<span>{item.meta}</span></>}
          </div>
        </div>
      </button>

      <div className="mt-auto px-3 pb-3 space-y-1.5">
        {onToggleWatched && (
          <button
            onClick={() => onToggleWatched(item)}
            className={`w-full text-sm py-1.5 rounded-lg transition ${
              watched
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-border)]'
            }`}
          >
            {watched ? t('card.watched') : t('card.markWatched')}
          </button>
        )}
        {onToggleWatchlist && (
          <button
            onClick={() => onToggleWatchlist(item)}
            className={`w-full text-xs py-1.5 rounded-lg transition ${
              inWatchlist
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-text)] border border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/30'
                : 'bg-transparent border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
            }`}
          >
            {inWatchlist ? t('card.inWatchlist') : t('card.addToWatchlist')}
          </button>
        )}
      </div>
    </div>
  )
}
