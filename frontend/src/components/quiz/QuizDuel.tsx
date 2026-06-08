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

  const remaining = (session.remaining as number[]) ?? []
  const idA = remaining[0]
  const idB = remaining[1]
  const itemA = idA !== undefined ? itemMap.get(idA) : undefined
  const itemB = idB !== undefined ? itemMap.get(idB) : undefined

  const eliminated = (session.eliminated as number[]) ?? []
  const totalItems = session.totalItems ?? 0
  const totalMatchups = totalItems > 1 ? totalItems - 1 : 0
  const doneMatchups = eliminated.length
  const currentRound = session.currentRound ?? 1

  useEffect(() => {
    setChosenId(null)
    setTransitioning(false)
  }, [idA, idB])

  const handleVote = useCallback(async (winnerId: number, loserId: number) => {
    if (isVoting || chosenId !== null) return
    setIsVoting(true)
    setChosenId(winnerId)
    try {
      const updated = await voteQuiz(session.id, winnerId, loserId)
      await new Promise((r) => setTimeout(r, 450))
      setTransitioning(true)
      await new Promise((r) => setTimeout(r, 200))
      onSessionUpdate(updated)
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
    <div className={`flex flex-col items-center gap-5 transition-opacity duration-200 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
      {/* Info row — no NaN, no maçup */}
      <div className="flex flex-col items-center gap-1">
        <p
          className="text-xl sm:text-3xl font-black text-[var(--color-text)]"
          style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.08em' }}
        >
          {t('quiz.pickOne')}
        </p>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
          <span>{t('quiz.round', { round: currentRound })}</span>
          <span>·</span>
          <span>{t('quiz.remaining', { count: remaining.length })}</span>
          {totalMatchups > 0 && (
            <>
              <span>·</span>
              <span>{t('quiz.completedMatches', { done: doneMatchups, total: totalMatchups })}</span>
            </>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex items-stretch gap-3 sm:gap-6 w-full" style={{ maxWidth: '900px' }}>
        <DuelCard
          item={itemA}
          isChosen={chosenId === idA}
          isLoser={chosenId !== null && chosenId !== idA}
          disabled={isVoting}
          onVote={() => handleVote(idA, idB)}
        />
        <div className="shrink-0 self-center">
          <span
            className="font-black select-none text-[var(--color-brand)]"
            style={{ fontSize: 'clamp(24px, 4vw, 44px)', fontFamily: '"Bebas Neue", Impact, sans-serif', textShadow: '0 0 24px rgba(255,59,71,0.6)' }}
          >
            VS
          </span>
        </div>
        <DuelCard
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

function DuelCard({ item, isChosen, isLoser, disabled, onVote }: {
  item: { title: string; poster_path: string | null; year: string | null }
  isChosen: boolean; isLoser: boolean; disabled: boolean; onVote: () => void
}) {
  const imgSrc = poster(item.poster_path, 'w500')
  return (
    <button
      onClick={onVote}
      disabled={disabled}
      className={[
        'group relative flex-1 rounded-2xl overflow-hidden focus:outline-none',
        'transition-all duration-300 ease-out',
        isChosen ? 'ring-4 ring-[var(--color-brand)] scale-[1.02] shadow-[0_0_50px_rgba(255,59,71,0.45)]'
          : isLoser ? 'opacity-20 scale-[0.96]'
          : 'cursor-pointer hover:scale-[1.01] hover:ring-2 hover:ring-white/15',
      ].join(' ')}
      style={{ aspectRatio: '2/3', minHeight: '320px', maxHeight: '540px' }}
    >
      {imgSrc
        ? <img src={imgSrc} alt={item.title} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        : <div className="absolute inset-0 bg-[var(--color-surface-2)] flex items-center justify-center p-4 text-sm text-center">{item.title}</div>
      }
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent" />
      {!isChosen && !isLoser && <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-200" />}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-bold text-sm sm:text-base leading-snug drop-shadow line-clamp-2">{item.title}</p>
        {item.year && <p className="text-white/50 text-xs mt-0.5">{item.year}</p>}
      </div>
      {isChosen && (
        <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[var(--color-brand)] flex items-center justify-center shadow-xl">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3.5 9.5l4 4 7-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </button>
  )
}
