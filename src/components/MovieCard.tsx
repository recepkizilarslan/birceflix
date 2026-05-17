import { poster, type TmdbMovie } from '../lib/api'

interface Props {
  movie: TmdbMovie
  watched: boolean
  onToggleWatched: (m: TmdbMovie) => void
  onOpen: (m: TmdbMovie) => void
  canMark: boolean
}

export function MovieCard({ movie, watched, onToggleWatched, onOpen, canMark }: Props) {
  const year = movie.release_date?.slice(0, 4) ?? ''
  return (
    <div className="group rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition">
      <button onClick={() => onOpen(movie)} className="block w-full text-left">
        <div className="aspect-[2/3] bg-[var(--color-surface-2)] overflow-hidden">
          {poster(movie.poster_path) ? (
            <img
              src={poster(movie.poster_path)!}
              alt={movie.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-dim)]">
              Poster yok
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium leading-snug line-clamp-2">{movie.title}</h3>
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
          onClick={() => onToggleWatched(movie)}
          className={`w-full text-sm py-1.5 rounded-lg transition ${
            !canMark
              ? 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)] cursor-not-allowed'
              : watched
              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
              : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-border)]'
          }`}
          title={canMark ? '' : 'Giriş yapınca işaretleyebilirsin'}
        >
          {watched ? '✓ İzledim' : 'İzledim olarak işaretle'}
        </button>
      </div>
    </div>
  )
}
