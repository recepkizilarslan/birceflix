import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, Medal, RotateCcw, Crown } from 'lucide-react'
import { poster, type QuizSession } from '../../lib/api'

interface QuizResultProps {
  session: QuizSession
  itemMap: Map<number, { title: string; poster_path: string | null; year: string | null }>
  onPlayAgain: () => void
}

export function QuizResult({ session, itemMap, onPlayAgain }: QuizResultProps) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { const id = setTimeout(() => setRevealed(true), 60); return () => clearTimeout(id) }, [])

  const eliminated = (session.eliminated as number[]) ?? []
  const winnerId = session.winnerId
  const rankedIds: number[] = winnerId ? [winnerId, ...eliminated] : eliminated

  const getItem = (id: number) => itemMap.get(id) ?? { title: `#${id}`, poster_path: null, year: null }
  const champion = winnerId ? getItem(winnerId) : null
  const championImg = session.winnerPosterPath
    ? poster(session.winnerPosterPath, 'w342')
    : champion?.poster_path ? poster(champion.poster_path, 'w342') : null

  const top3Others = rankedIds.slice(1, 3)

  return (
    <div className={`w-full max-w-3xl mx-auto transition-all duration-700 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 mb-4">
          <Crown size={14} className="text-yellow-400" />
          <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest">BirceRank</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-black text-[var(--color-text)] mb-1" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.06em' }}>
          {t('quiz.resultTitle')}
        </h1>
        <p className="text-[var(--color-text-dim)] text-sm">
          {session.categoryLabel} · {t('quiz.itemsCount', { count: session.totalItems })} · {session.currentRound} {t('quiz.roundSub')}
        </p>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-4 sm:gap-6 mb-10">
        {top3Others[0] !== undefined && (
          <PodiumCard rank={2} item={getItem(top3Others[0])} height="h-44 sm:h-52" medalColor="text-slate-300" ringColor="ring-slate-400/40" />
        )}
        {champion && (
          <div className="flex flex-col items-center gap-3 -mt-8 z-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-yellow-400/25 blur-2xl scale-150" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.55)]">
                <Trophy size={34} className="text-white" />
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-4 ring-yellow-400/70 shadow-[0_0_60px_rgba(234,179,8,0.3)] w-36 sm:w-44" style={{ aspectRatio: '2/3' }}>
              {championImg
                ? <img src={championImg} alt={champion.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-[var(--color-surface-2)] flex items-center justify-center p-3 text-sm font-bold text-center">{champion.title}</div>
              }
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
              <div className="absolute top-2 left-1/2 -translate-x-1/2">
                <span className="bg-yellow-400 text-black text-xs font-black px-2 py-0.5 rounded-full">#1</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
                <p className="text-white font-bold text-xs sm:text-sm leading-snug drop-shadow line-clamp-2">{champion.title}</p>
                {champion.year && <p className="text-white/50 text-xs mt-0.5">{champion.year}</p>}
              </div>
            </div>
          </div>
        )}
        {top3Others[1] !== undefined && (
          <PodiumCard rank={3} item={getItem(top3Others[1])} height="h-36 sm:h-44" medalColor="text-amber-600" ringColor="ring-amber-700/40" />
        )}
      </div>

      {/* Full ranking */}
      {rankedIds.length > 3 && (
        <div className="mb-8">
          <h2 className="text-[var(--color-text-dim)] text-xs font-semibold uppercase tracking-widest mb-3 px-1">{t('quiz.fullRanking')}</h2>
          <div className="flex flex-col gap-1.5">
            {rankedIds.slice(3).map((id, idx) => {
              const item = getItem(id)
              const imgSrc = item.poster_path ? poster(item.poster_path, 'w185') : null
              return (
                <div key={id} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)] transition-colors">
                  <span className="w-7 text-center text-[var(--color-text-dim)] text-sm font-bold tabular-nums shrink-0">{idx + 4}</span>
                  {imgSrc ? <img src={imgSrc} alt={item.title} className="w-8 h-12 object-cover rounded-md shrink-0" /> : <div className="w-8 h-12 rounded-md bg-[var(--color-surface-2)] shrink-0" />}
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

      <div className="flex justify-center pb-8">
        <button onClick={onPlayAgain} id="quiz-play-again-btn" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-brand)] text-white font-bold text-sm hover:opacity-90 transition shadow-lg shadow-[var(--color-brand)]/30">
          <RotateCcw size={16} />
          {t('quiz.playAgain')}
        </button>
      </div>
    </div>
  )
}

function PodiumCard({ rank, item, height, medalColor, ringColor }: { rank: number; item: { title: string; poster_path: string | null; year: string | null }; height: string; medalColor: string; ringColor: string }) {
  const imgSrc = item.poster_path ? poster(item.poster_path, 'w342') : null
  return (
    <div className="flex flex-col items-center gap-2">
      <Medal size={22} className={medalColor} />
      <div className={['relative rounded-xl overflow-hidden shadow-xl w-28 sm:w-32 ring-2', ringColor, height].join(' ')}>
        {imgSrc ? <img src={imgSrc} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[var(--color-surface-2)] flex items-center justify-center text-xs text-center p-2 font-bold">{item.title}</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2"><span className="bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm">#{rank}</span></div>
        <div className="absolute bottom-0 left-0 right-0 p-2 text-center"><p className="text-white font-bold text-xs leading-snug line-clamp-2">{item.title}</p></div>
      </div>
    </div>
  )
}
