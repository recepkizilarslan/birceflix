import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { MovieCard } from '../components/MovieCard'
import type { TmdbMovie } from '../lib/api'

export function Watched() {
  const { t } = useTranslation()
  const { user, watchedRows, watchedIds, toggleWatched } = useOutletContext<LayoutContext>()
  const navigate = useNavigate()

  if (!user) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
        <div className="text-lg mb-2">{t('watched.signInPrompt')}</div>
        <div className="text-sm text-[var(--color-text-dim)]">{t('auth.signInHint')}</div>
      </div>
    )
  }

  if (watchedRows.length === 0) {
    return (
      <div className="text-center text-[var(--color-text-dim)] py-10">{t('watched.empty')}</div>
    )
  }

  const cards = watchedRows.map((r) => {
    const movie: TmdbMovie = {
      id: r.tmdb_id,
      title: r.title,
      original_title: r.title,
      original_language: '',
      overview: '',
      poster_path: r.poster_path,
      backdrop_path: null,
      release_date: r.watched_at.slice(0, 10),
      vote_average: 0,
      vote_count: 0,
    }
    return { movie, myRating: r.my_rating }
  })

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
      {cards.map(({ movie, myRating }) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          watched={watchedIds.has(movie.id)}
          canMark={!!user}
          myRating={myRating}
          onToggleWatched={toggleWatched}
          onOpen={(mv) => navigate(`/movie/${mv.id}`)}
        />
      ))}
    </div>
  )
}
