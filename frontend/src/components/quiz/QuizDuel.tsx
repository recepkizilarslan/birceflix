/**
 * QuizDuel — The main 1v1 matchup screen.
 *
 * Shows two poster cards side by side with a VS badge in the middle.
 * On selection: dims the loser, brightens the winner, shows global stats
 * overlay briefly, then transitions to the next matchup.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { poster, voteQuiz, getQuizStats, type QuizSession, type QuizStats, type QuizMediaType } from '../lib/api'

interface QuizDuelProps {
  session: QuizSession
  /** TMDB poster_path and title for each item — pre-fetched by parent. */
  itemMap: Map<number, { title: string; poster_path: string | null; year: string | null }>
  mediaType: QuizMediaType
  onSessionUpdate: (updated: QuizSession) => void
}

export function QuizDuel({ session, itemMap, mediaType, onSessionUpdate }: QuizDuelProps) {
  const { t } = useTranslation()

  const [isVoting, setIsVoting] = useState(false)
  const [chosenId, setChosenId] = useState<number | null>(null)
  const [stats, setStats] = useState<QuizStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  const remaining = session.remaining
  const idA = remaining[0]
  const idB = remaining[1]
  const itemA = idA !== undefined ? itemMap.get(idA) : undefined
  const itemB = idB !== undefined ? itemMap.get(idB) : undefined

  // Votes done = total - remaining (bracket always halves each round so we
  // track progress as eliminated count vs total).
  const totalMatchups = session.total_items - 1
  const doneMatchups = session.eliminated.length

  // Reset local state on new duel (idA/idB change).
  useEffect(() => {
    setChosenId(null)
    setStats(null)
    setShowStats(false)
    setTransitioning(false)
  }, [idA, idB])

  const handleVote = useCallback(async (winnerId: number, loserId: number) => {
    if (isVoting || chosenId !== null) return
    setIsVoting(true)
    setChosenId(winnerId)

    try {
      // Fire vote + stats fetch in parallel
      const [updatedSession, fetchedStats] = await Promise.all([
        voteQuiz(session.id, winnerId, loserId),
        getQuizStats(idA!, idB!, mediaType).catch(() => null),
      ])

      setStats(fetchedStats)
      setShowStats(true)

      // Show stats for 1.6 s then advance
      await new Promise((r) => setTimeout(r, 1600))
      setShowStats(false)
      setTransitioning(true)

      await new Promise((r) => setTimeout(r, 300))
      onSessionUpdate(updatedSession)
    } catch (err) {
      console.error('Vote failed', err)
    } finally {
      setIsVoting(false)
      setTransitioning(false)
    }
  }, [isVoting, chosenId, session.id, idA, idB, mediaType, onSessionUpdate])

  if (!idA || !idB || !itemA || !itemB) return null

  const progress = Math.round((doneMatchups / totalMatchups) * 100)

  return (
    <div
      className={`flex flex-col items-center gap-4 transition-opacity duration-300 ${transitioning ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* ── Progress bar ── */}
      <div className="w-full max-w-xl flex flex-col items-center gap-1.5">
        <p className="text-[13px] text-[var(--color-text-dim)] tabular-nums">
          {t('quiz.progress', { done: doneMatchups, total: totalMatchups })}
          {' · '}
          {t('quiz.round', { round: session.current_round })}
          {' · '}
          {t('quiz.remaining', { count: remaining.length })}
        </p>
        <div className="w-full h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-brand)] to-[#ff8c00] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Pick label ── */}
      <p className="text-base font-semibold text-[var(--color-text-dim)] tracking-wide uppercase text-[11px] letter-spacing-widest">
        {t('quiz.pickOne')}
      </p>

      {/* ── Duel cards ── */}
      <div className="flex items-center gap-4 sm:gap-6 w-full max-w-2xl">
        <DuelCard
          id={idA}
          item={itemA}
          isChosen={chosenId === idA}
          isLoser={chosenId !== null && chosenId !== idA}
          disabled={isVoting}
          stats={stats && chosenId !== null ? { pct: stats.candidate_a === idA ? stats.pct_a : stats.pct_b, total: stats.total } : null}
          showStats={showStats}
          onVote={() => handleVote(idA, idB)}
        />

        {/* VS badge */}
        <div className="shrink-0 flex flex-col items-center gap-1 z-10">
          <span
            className="text-[var(--color-brand)] font-black text-2xl sm:text-3xl select-none"
            style={{
              textShadow: '0 0 20px rgba(255,59,71,0.6)',
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
          stats={stats && chosenId !== null ? { pct: stats.candidate_b === idB ? stats.pct_b : stats.pct_a, total: stats.total } : null}
          showStats={showStats}
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
  stats: { pct: number; total: number } | null
  showStats: boolean
  onVote: () => void
}

function DuelCard({ item, isChosen, isLoser, disabled, stats, showStats, onVote }: DuelCardProps) {
  const { t } = useTranslation()
  const imgSrc = poster(item.poster_path, 'w342')

  return (
    <button
      onClick={onVote}
      disabled={disabled}
      className={`
        group relative flex-1 rounded-xl overflow-hidden
        transition-all duration-300 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]
        ${isChosen
          ? 'ring-4 ring-[var(--color-brand)] scale-[1.03] shadow-[0_0_40px_rgba(255,59,71,0.45)]'
          : isLoser
          ? 'opacity-35 scale-[0.97]'
          : 'hover:scale-[1.015] hover:ring-2 hover:ring-[var(--color-brand)]/60 cursor-pointer'
        }
      `}
      style={{ aspectRatio: '2/3' }}
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
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-2)] text-[var(--color-text-dim)] text-sm p-4 text-center">
          {item.title}
        </div>
      )}

      {/* Gradient overlay at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* Title + year */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white font-bold text-sm sm:text-base leading-tight drop-shadow line-clamp-2">
          {item.title}
        </p>
        {item.year && (
          <p className="text-white/60 text-xs mt-0.5">{item.year}</p>
        )}
      </div>

      {/* Global stats overlay */}
      {showStats && stats !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <p className="text-white text-4xl sm:text-5xl font-black tabular-nums drop-shadow-lg">
            {stats.pct}%
          </p>
          {stats.total > 0 ? (
            <p className="text-white/70 text-xs mt-1 text-center px-2">
              {t('quiz.globalStats', { pct: stats.pct })}
            </p>
          ) : (
            <p className="text-white/70 text-xs mt-1 text-center px-2">
              {t('quiz.globalStatsFirst')}
            </p>
          )}
        </div>
      )}

      {/* Chosen checkmark */}
      {isChosen && !showStats && (
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[var(--color-brand)] flex items-center justify-center shadow-lg">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  )
}
