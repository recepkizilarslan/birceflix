/**
 * QuizDuel — The main 1v1 matchup screen.
 *
 * Two large poster cards fill the screen left/right.
 * Stats overlay removed — no percentage shown during gameplay.
 * Progress bar removed — only text info shown (round / remaining).
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { poster, voteQuiz, type QuizSession, type QuizMediaType } from '../../lib/api'

interface QuizDuelProps {
  session: QuizSession
  itemMap: Map<number, { title: string; poster_path: string | null; year: string | null }>
  mediaType: QuizMediaType
  onSessionUpdate: (updated: QuizSession) => void
}

export function QuizDuel({ session, itemMap, onSessionUpdate }: QuizDuelProps) {
  const { t } = useTranslation()

  const [isVoting, setIsVoting] = useState(false)
  const [chosenId, setChosenId] = useState<number | null>(null)
  const [transitioning, setTransitioning] = useState(false)

  const remaining = session.remaining
  const idA = remaining[0]
  const idB = remaining[1]
  const itemA = idA !== undefined ? itemMap.get(idA) : undefined
  const itemB = idB !== undefined ? itemMap.get(idB) : undefined

  // Total matchups in a bracket of size N = N - 1
  const totalMatchups = session.total_items - 1
  const doneMatchups = session.eliminated.length
  const leftMatchups = totalMatchups - doneMatchups

  useEffect(() => {
    setChosenId(null)
    setTransitioning(false)
  }, [idA, idB])

  const handleVote = useCallback(async (winnerId: number, loserId: number) => {
    if (isVoting || chosenId !== null) return
    setIsVoting(true)
    setChosenId(winnerId)

    try {
      const updatedSession = await voteQuiz(session.id, winnerId, loserId)

      // Brief winner highlight pause
      await new Promise((r) => setTimeout(r, 500))
      setTransitioning(true)
      await new Promise((r) => setTimeout(r, 250))
      onSessionUpdate(updatedSession)
    } catch (err) {
      console.error('Vote failed', err)
      setChosenId(null)
    } finally {
      setIsVoting(false)
      setTransitioning(false)
    }
  }, [isVoting, chosenId, session.id, onSessionUpdate])

  if (!idA || !idB || !itemA || !itemB) return null

  return (
    <div
      className={`flex flex-col items-center gap-5 transition-opacity duration-250 ${transitioning ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* ── Info row: "Hangisi daha iyi?" + stats ── */}
      <div className="flex flex-col items-center gap-1">
        <p
          className="text-xl sm:text-2xl font-black text-[var(--color-text)] tracking-wide"
          style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.06em' }}
        >
          {t('quiz.pickOne')}
        </p>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-dim)] tabular-nums">
          <span>{t('quiz.round', { round: session.current_round })}</span>
          <span className="text-[var(--color-text-dim)]/40">·</span>
          <span>{t('quiz.remaining', { count: leftMatchups })}</span>
          <span className="text-[var(--color-text-dim)]/40">·</span>
          <span>{doneMatchups}/{totalMatchups} {t('quiz.matchupsDone')}</span>
        </div>
      </div>

      {/* ── Duel cards ── */}
      <div className="flex items-stretch gap-3 sm:gap-5 w-full" style={{ maxWidth: '860px' }}>
        <DuelCard
          id={idA}
          item={itemA}
          isChosen={chosenId === idA}
          isLoser={chosenId !== null && chosenId !== idA}
          disabled={isVoting}
          onVote={() => handleVote(idA, idB)}
        />

        {/* VS badge */}
        <div className="shrink-0 flex flex-col items-center justify-center self-center z-10">
          <span
            className="text-[var(--color-brand)] font-black select-none"
            style={{
              fontSize: 'clamp(28px, 4vw, 48px)',
              textShadow: '0 0 30px rgba(255,59,71,0.7)',
              fontFamily: '"Bebas Neue", Impact, sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            VS
          </span>
        </div>

        <DuelCard
          id={idB}
          item={itemB}
          isChosen={chosenId === idB}
          isLoser={chosenId !== null && chosenId !== idB}
          disabled={isVoting}
          onVote={() => handleVote(idB, idA)}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DuelCard
// ---------------------------------------------------------------------------
interface DuelCardProps {
  id: number
  item: { title: string; poster_path: string | null; year: string | null }
  isChosen: boolean
  isLoser: boolean
  disabled: boolean
  onVote: () => void
}

function DuelCard({ item, isChosen, isLoser, disabled, onVote }: DuelCardProps) {
  const imgSrc = poster(item.poster_path, 'w500')

  return (
    <button
      onClick={onVote}
      disabled={disabled}
      className={[
        'group relative flex-1 rounded-2xl overflow-hidden cursor-pointer',
        'transition-all duration-300 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]',
        isChosen
          ? 'ring-4 ring-[var(--color-brand)] scale-[1.02] shadow-[0_0_50px_rgba(255,59,71,0.5)]'
          : isLoser
          ? 'opacity-25 scale-[0.96]'
          : 'hover:scale-[1.015] hover:ring-2 hover:ring-white/20 hover:shadow-2xl',
      ].join(' ')}
      style={{ aspectRatio: '2/3', minHeight: '340px', maxHeight: '520px' }}
    >
      {/* Poster image */}
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-2)] text-[var(--color-text-dim)] text-sm p-4 text-center font-medium">
          {item.title}
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent" />

      {/* Hover tint */}
      {!isChosen && !isLoser && (
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-200" />
      )}

      {/* Title + year */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-bold text-sm sm:text-base leading-snug drop-shadow-lg line-clamp-2">
          {item.title}
        </p>
        {item.year && (
          <p className="text-white/50 text-xs mt-0.5">{item.year}</p>
        )}
      </div>

      {/* Winner checkmark */}
      {isChosen && (
        <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[var(--color-brand)] flex items-center justify-center shadow-xl">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3.5 9.5l4 4 7-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  )
}
