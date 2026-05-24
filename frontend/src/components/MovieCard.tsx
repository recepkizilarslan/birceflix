import { useTranslation } from 'react-i18next'
import { poster, getContentTitle, type TmdbMovie } from '../lib/api'

interface Props {
  movie: TmdbMovie
  watched: boolean
  onToggleWatched: (m: TmdbMovie) => void
  onOpen: (m: TmdbMovie) => void
  canMark: boolean
  /** When set, shown as a corner badge — used on the Watched page. */
  myRating?: number | null
}

export function MovieCard({ movie, watched, onToggleWatched, onOpen, canMark, myRating }: Props) {
  const { t } = useTranslation()
  const year = movie.release_date?.slice(0, 4) ?? ''
  const displayTitle = getContentTitle(movie)
  return (
    <div className="group rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition">
      <button onClick={() => onOpen({ ...movie, title: displayTitle })} className="block w-full text-left">
        <div className="relative aspect-[2/3] bg-[var(--color-surface-2)] overflow-hidden">
          {poster(movie.poster_path) ? (
            <img
              src={poster(movie.poster_path)!}
              alt={displayTitle}
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
            <h3 className="text-sm font-medium leading-snug line-clamp-2">{displayTitle}</h3>
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              ★ {movie.vote_average.toFixed(1)}
            </span>
          </div>
          <div className="text-xs text-[var(--color-text-dim)] mt-1">{year}</div>
        </div>
      </button>
      <div className="px-3 pb-3">
        <button
          disabled={!canMark}
          onClick={() => onToggleWatched({ ...movie, title: displayTitle })}
          className={`w-full text-sm py-1.5 rounded-lg transition ${
            !canMark
              ? 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)] cursor-not-allowed'
              : watched
              ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] border border-[var(--color-brand)]/40 hover:bg-[var(--color-brand)]/25'
              : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-border)]'
          }`}
          title={canMark ? '' : t('card.signInToMark')}
        >
          {watched ? t('card.watched') : t('card.markWatched')}
        </button>
      </div>
    </div>
  )
}
