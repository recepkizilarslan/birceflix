/**
 * QuizResult — Full ranking reveal after tournament completion.
 *
 * Shows champion (#1) prominently, then a ranked list of eliminated items.
 * Eliminated order = last eliminated → first, so final runner-up is #2.
 * Also shows global win-rate stats for the champion via /api/quiz/stats.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, Medal, RotateCcw, Crown } from 'lucide-react'
import { poster, getQuizHistory, type QuizSession } from '../../lib/api'

interface QuizResultProps {
  session: QuizSession
  /** Full itemMap so we can show all ranked posters. */
  itemMap: Map<number, { title: string; poster_path: string | null; year: string | null }>
  onPlayAgain: () => void
}

export function QuizResult({ session, itemMap, onPlayAgain }: QuizResultProps) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)

  // Trigger entrance animation
  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 50)
    return () => clearTimeout(id)
  }, [])

  // Build ranking list
  // eliminated is stored as [most recent loser first, ..., first loser last]
  // so index 0 = final runner-up (#2), index 1 = semi-final loser (#3), etc.
  const eliminated = (session.eliminated as number[]) ?? []
  const winnerId = session.winner_id

  // Full ranking: winner first, then eliminated in reverse elimination order
  const rankedIds: number[] = winnerId
    ? [winnerId, ...eliminated]
    : eliminated

  const getItem = (id: number) =>
    itemMap.get(id) ?? { title: `#${id}`, poster_path: null, year: null }

  const champion = winnerId ? getItem(winnerId) : null
  const championImg = session.winner_poster_path
    ? poster(session.winner_poster_path, 'w342')
    : champion?.poster_path
    ? poster(champion.poster_path, 'w342')
    : null

  const top3 = rankedIds.slice(1, 3) // #2 and #3

  return (
    <div
      className={`w-full max-w-3xl mx-auto transition-all duration-700 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      {/* ── Header ── */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 mb-4">
          <Crown size={14} className="text-yellow-400" />
          <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest">BirceRank</span>
        </div>
        <h1
          className="text-4xl sm:text-6xl font-black text-[var(--color-text)] mb-1"
          style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.06em' }}
        >
          {t('quiz.resultTitle')}
        </h1>
        <p className="text-[var(--color-text-dim)] text-sm">
          {session.category_label} · {session.total_items} {t('quiz.items', { count: session.total_items })}
        </p>
      </div>

      {/* ── Podium: #1 centre, #2 left, #3 right ── */}
      <div className="flex items-end justify-center gap-3 sm:gap-5 mb-10">

        {/* #2 */}
        {top3[0] !== undefined && (
          <PodiumCard
            rank={2}
            id={top3[0]}
            item={getItem(top3[0])}
            height="h-44 sm:h-52"
            medalColor="text-slate-300"
            ringColor="ring-slate-400/40"
          />
        )}

        {/* #1 Champion */}
        {champion && (
          <div className="flex flex-col items-center gap-2 -mt-8 z-10">
            <div className="relative">
              {/* Glow */}
              <div className="absolute inset-0 rounded-full bg-yellow-400/30 blur-2xl scale-150" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.6)]">
                <Trophy size={32} className="text-white sm:hidden" />
                <Trophy size={40} className="text-white hidden sm:block" />
              </div>
            </div>
            <div
              className={[
                'relative rounded-2xl overflow-hidden shadow-2xl',
                'ring-4 ring-yellow-400/70',
                'shadow-[0_0_60px_rgba(234,179,8,0.35)]',
                'w-36 sm:w-44',
              ].join(' ')}
              style={{ aspectRatio: '2/3' }}
            >
              {championImg ? (
                <img src={championImg} alt={champion.title} className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full bg-[var(--color-surface-2)] flex items-center justify-center text-center p-3 text-sm font-bold text-[var(--color-text)]">
                  {champion.title}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
              <div className="absolute top-2 left-1/2 -translate-x-1/2">
                <span className="bg-yellow-400 text-black text-xs font-black px-2 py-0.5 rounded-full shadow">#1</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
                <p className="text-white font-bold text-xs sm:text-sm leading-snug drop-shadow line-clamp-2">{champion.title}</p>
                {champion.year && <p className="text-white/50 text-xs mt-0.5">{champion.year}</p>}
              </div>
            </div>
          </div>
        )}

        {/* #3 */}
        {top3[1] !== undefined && (
          <PodiumCard
            rank={3}
            id={top3[1]}
            item={getItem(top3[1])}
            height="h-36 sm:h-44"
            medalColor="text-amber-600"
            ringColor="ring-amber-700/40"
          />
        )}
      </div>

      {/* ── Full ranking list ── */}
      {rankedIds.length > 3 && (
        <div className="mb-8">
          <h2 className="text-[var(--color-text-dim)] text-xs font-semibold uppercase tracking-widest mb-3 px-1">
            {t('quiz.fullRanking')}
          </h2>
          <div className="flex flex-col gap-1.5">
            {rankedIds.slice(3).map((id, idx) => {
              const rank = idx + 4
              const item = getItem(id)
              const imgSrc = item.poster_path ? poster(item.poster_path, 'w92') : null
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <span className="w-7 text-center text-[var(--color-text-dim)] text-sm font-bold tabular-nums shrink-0">
                    {rank}
                  </span>
                  {imgSrc ? (
                    <img src={imgSrc} alt={item.title} className="w-8 h-12 object-cover rounded-md shrink-0" />
                  ) : (
                    <div className="w-8 h-12 rounded-md bg-[var(--color-surface-2)] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[var(--color-text)] text-sm font-medium truncate">{item.title}</p>
                    {item.year && <p className="text-[var(--color-text-dim)] text-xs">{item.year}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Action button ── */}
      <div className="flex justify-center pb-8">
        <button
          onClick={onPlayAgain}
          id="quiz-play-again-btn"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white font-bold text-sm hover:opacity-90 transition shadow-lg shadow-[var(--color-brand)]/30"
        >
          <RotateCcw size={16} />
          {t('quiz.playAgain')}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PodiumCard — #2 / #3
// ---------------------------------------------------------------------------
interface PodiumCardProps {
  rank: number
  id: number
  item: { title: string; poster_path: string | null; year: string | null }
  height: string
  medalColor: string
  ringColor: string
}

function PodiumCard({ rank, item, height, medalColor, ringColor }: PodiumCardProps) {
  const imgSrc = item.poster_path ? poster(item.poster_path, 'w342') : null

  return (
    <div className="flex flex-col items-center gap-2">
      <Medal size={22} className={medalColor} />
      <div
        className={['relative rounded-xl overflow-hidden shadow-xl w-28 sm:w-36 ring-2', ringColor, height].join(' ')}
      >
        {imgSrc ? (
          <img src={imgSrc} alt={item.title} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full bg-[var(--color-surface-2)] flex items-center justify-center text-center p-2 text-xs font-bold text-[var(--color-text)]">
            {item.title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2">
          <span className="bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm">#{rank}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
          <p className="text-white font-bold text-xs leading-snug drop-shadow line-clamp-2">{item.title}</p>
        </div>
      </div>
    </div>
  )
}
