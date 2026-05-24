/**
 * QuizResult — Champion reveal screen shown when a tournament completes.
 */
import { useTranslation } from 'react-i18next'
import { Trophy, RotateCcw, History } from 'lucide-react'
import { Link } from 'react-router-dom'
import { poster, type QuizSession } from '../../lib/api'

interface QuizResultProps {
  session: QuizSession
  onPlayAgain: () => void
}

export function QuizResult({ session, onPlayAgain }: QuizResultProps) {
  const { t } = useTranslation()
  const imgSrc = poster(session.winner_poster_path, 'w342')

  return (
    <div className="flex flex-col items-center gap-6 py-8 animate-fade-in">
      {/* Trophy icon */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.5)]">
          <Trophy size={40} className="text-white" />
        </div>
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full border-2 border-yellow-400/30 animate-ping" />
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-3xl sm:text-4xl font-black text-[var(--color-text)] mb-1" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.05em' }}>
          {t('quiz.resultTitle')}
        </h2>
        <p className="text-[var(--color-text-dim)] text-sm">
          {t('quiz.resultSubtitle')}
        </p>
      </div>

      {/* Winner card */}
      <div className="relative max-w-[220px] w-full">
        <div className="relative rounded-xl overflow-hidden shadow-2xl ring-4 ring-yellow-400/60 shadow-[0_0_60px_rgba(234,179,8,0.3)]">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={session.winner_title ?? ''}
              className="w-full object-cover"
              style={{ aspectRatio: '2/3' }}
            />
          ) : (
            <div
              className="w-full bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text)] text-center p-6 text-lg font-semibold"
              style={{ aspectRatio: '2/3' }}
            >
              {session.winner_title}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
            <p className="text-white font-bold text-base drop-shadow leading-tight">
              {session.winner_title}
            </p>
          </div>
        </div>

        {/* Confetti stars (CSS only) */}
        <div className="absolute -top-3 -left-3 text-yellow-400 text-xl select-none animate-bounce" style={{ animationDelay: '0s' }}>★</div>
        <div className="absolute -top-4 -right-4 text-orange-400 text-2xl select-none animate-bounce" style={{ animationDelay: '0.3s' }}>★</div>
        <div className="absolute -bottom-3 -left-5 text-yellow-300 text-lg select-none animate-bounce" style={{ animationDelay: '0.6s' }}>★</div>
        <div className="absolute -bottom-4 right-0 text-amber-400 text-xl select-none animate-bounce" style={{ animationDelay: '0.15s' }}>★</div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-center text-sm text-[var(--color-text-dim)]">
        <div>
          <p className="text-2xl font-bold text-[var(--color-text)] tabular-nums">{session.total_items}</p>
          <p>{t('quiz.items', { count: session.total_items })}</p>
        </div>
        <div className="w-px h-10 bg-[var(--color-border)]" />
        <div>
          <p className="text-2xl font-bold text-[var(--color-text)] tabular-nums">{session.current_round}</p>
          <p>{t('quiz.round', { round: '' }).replace(' ', '')}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onPlayAgain}
          id="quiz-play-again-btn"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--color-brand)] text-white font-semibold text-sm hover:opacity-90 transition"
        >
          <RotateCcw size={15} />
          {t('quiz.playAgain')}
        </button>
        <Link
          to="/quiz"
          id="quiz-view-history-link"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] text-sm hover:bg-[var(--color-surface)] transition"
        >
          <History size={15} />
          {t('quiz.viewHistory')}
        </Link>
      </div>
    </div>
  )
}
