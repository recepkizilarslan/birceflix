/**
 * BirceRank — 1v1 Tournament Hub
 *
 * Views:
 *   1. Hub: Category cards with visuals + bracket size selector + filters
 *   2. Playing: QuizDuel
 *   3. Result: QuizResult (full ranking)
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Crown, ChevronDown } from 'lucide-react'
import {
  listQuizCategories,
  createQuizSession,
  top,
  poster,
  type QuizCategory,
  type QuizSession,
  type QuizMediaType,
} from '../lib/api'
import { QuizDuel } from '../components/quiz/QuizDuel'
import { QuizResult } from '../components/quiz/QuizResult'
import { useRegion } from '../lib/preferences'
import { intlLocale } from '../i18n'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ItemMeta = { title: string; poster_path: string | null; year: string | null }
type ItemMap = Map<number, ItemMeta>

type BracketSize = 16 | 32 | 64 | 128

// ---------------------------------------------------------------------------
// Category visual config
// ---------------------------------------------------------------------------
const CAT_BG: Record<string, { gradient: string; accent: string; img: string }> = {
  top_movies: {
    gradient: 'from-red-950/80 via-red-900/60 to-orange-950/80',
    accent: 'bg-red-500',
    img: 'https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', // Shawshank
  },
  top_tv: {
    gradient: 'from-purple-950/80 via-indigo-900/60 to-purple-950/80',
    accent: 'bg-purple-500',
    img: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', // Breaking Bad
  },
  top_docs: {
    gradient: 'from-teal-950/80 via-cyan-900/60 to-teal-950/80',
    accent: 'bg-teal-500',
    img: 'https://image.tmdb.org/t/p/w500/apnpwnDA3iwfe7ZEnBSXGlRFaZ9.jpg', // Planet Earth
  },
}

const DEFAULT_BG = {
  gradient: 'from-gray-900/80 via-gray-800/60 to-gray-900/80',
  accent: 'bg-gray-500',
  img: '',
}

// Bracket size options
const BRACKET_SIZES: BracketSize[] = [16, 32, 64, 128]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function QuizPage() {
  const { t } = useTranslation()
  const [region] = useRegion()

  const [view, setView] = useState<'categories' | 'playing' | 'result'>('categories')
  const [categories, setCategories] = useState<QuizCategory[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [catError, setCatError] = useState(false)

  const [session, setSession] = useState<QuizSession | null>(null)
  const [itemMap, setItemMap] = useState<ItemMap>(new Map())
  const [starting, setStarting] = useState<string | null>(null)

  // Per-category bracket size preference
  const [bracketSizes, setBracketSizes] = useState<Record<string, BracketSize>>({
    top_movies: 64,
    top_tv: 64,
    top_docs: 32,
  })

  useEffect(() => {
    setLoadingCats(true)
    listQuizCategories()
      .then(setCategories)
      .catch(() => setCatError(true))
      .finally(() => setLoadingCats(false))
  }, [])

  const buildItemMap = useCallback(async (sess: QuizSession, cat: QuizCategory): Promise<ItemMap> => {
    const map = new Map<number, ItemMeta>()
    const mediaType = cat.media_type === 'doc' ? 'movie' : cat.media_type as 'movie' | 'tv'
    try {
      const snapshot = await top(mediaType, region ?? 'TR')
      for (const item of snapshot.items) {
        map.set(item.id, { title: item.title, poster_path: item.poster_path, year: item.year })
      }
    } catch { /* silent */ }

    const allIds = [...(sess.remaining as number[]), ...(sess.eliminated as number[])]
    if (sess.winner_id) allIds.push(sess.winner_id)
    for (const id of allIds) {
      if (!map.has(id)) map.set(id, { title: `#${id}`, poster_path: null, year: null })
    }
    return map
  }, [region])

  const handleStart = useCallback(async (cat: QuizCategory, resume: boolean) => {
    setStarting(cat.id)
    try {
      const bracketSize = bracketSizes[cat.id] ?? cat.max_items
      const sess = await createQuizSession(cat.id, {
        region: region ?? 'TR',
        ui_language: intlLocale(),
        resume,
        bracket_size: bracketSize,
      })

      const map = await buildItemMap(sess, cat)
      setItemMap(map)
      setSession(sess)

      if (sess.completed_at) {
        setView('result')
      } else {
        setView('playing')
      }
    } catch (err) {
      console.error('Failed to start session', err)
      alert(t('quiz.loadError'))
    } finally {
      setStarting(null)
    }
  }, [region, buildItemMap, t, bracketSizes])

  const handleSessionUpdate = useCallback(async (updated: QuizSession) => {
    setSession(updated)

    // If tournament just completed, we need to ensure itemMap has winner info
    if (updated.completed_at && updated.winner_id) {
      setItemMap((prev) => {
        const next = new Map(prev)
        if (!next.has(updated.winner_id!) && updated.winner_title) {
          next.set(updated.winner_id!, {
            title: updated.winner_title,
            poster_path: updated.winner_poster_path,
            year: null,
          })
        }
        return next
      })
      // Small delay for final card animation
      await new Promise((r) => setTimeout(r, 300))
      setView('result')
    }
  }, [])

  const handlePlayAgain = useCallback(() => {
    setSession(null)
    setItemMap(new Map())
    setView('categories')
    listQuizCategories().then(setCategories).catch(() => {})
  }, [])

  const activeCat = session
    ? categories.find((c) => c.id === session.category) ?? null
    : null

  // ── Playing view ──
  if (view === 'playing' && session && activeCat) {
    return (
      <div className="min-h-[75vh] flex flex-col px-2 sm:px-4">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-5 pt-1">
          <button
            onClick={() => {
              setView('categories')
              listQuizCategories().then(setCategories).catch(() => {})
            }}
            className="flex items-center gap-1.5 text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-sm transition"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-yellow-400" />
            <span
              className="text-lg font-black text-[var(--color-text)]"
              style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.05em' }}
            >
              BirceRank
            </span>
            <span className="text-[var(--color-text-dim)] text-sm">· {session.category_label}</span>
          </div>
          <div className="w-20" />
        </div>

        <QuizDuel
          session={session}
          itemMap={itemMap}
          mediaType={activeCat.media_type}
          onSessionUpdate={handleSessionUpdate}
        />
      </div>
    )
  }

  // ── Result view ──
  if (view === 'result' && session) {
    return (
      <div className="min-h-[75vh] py-4 px-2 sm:px-4">
        <QuizResult session={session} itemMap={itemMap} onPlayAgain={handlePlayAgain} />
      </div>
    )
  }

  // ── Category hub ──
  return (
    <div className="max-w-4xl mx-auto py-4 px-2 sm:px-0">
      {/* Hero header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 mb-5">
          <Crown size={14} className="text-yellow-400" />
          <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest">1v1 Turnuva</span>
        </div>
        <h1
          className="text-5xl sm:text-7xl font-black text-[var(--color-text)] mb-3"
          style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.06em' }}
        >
          BirceRank
        </h1>
        <p className="text-[var(--color-text-dim)] text-base max-w-sm mx-auto">
          {t('quiz.pageSubtitle')}
        </p>
      </div>

      {/* Category cards */}
      {loadingCats ? (
        <div className="flex items-center justify-center py-24 text-[var(--color-text-dim)]">
          <svg className="animate-spin mr-2" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {t('quiz.loading')}
        </div>
      ) : catError ? (
        <p className="text-center text-[var(--color-text-dim)] py-24">{t('quiz.loadError')}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-3">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              bracketSize={bracketSizes[cat.id] ?? (cat.max_items as BracketSize)}
              onBracketSizeChange={(size) =>
                setBracketSizes((prev) => ({ ...prev, [cat.id]: size }))
              }
              starting={starting === cat.id}
              onStart={() => handleStart(cat, false)}
              onResume={() => handleStart(cat, true)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CategoryCard — with background image, bracket size selector
// ---------------------------------------------------------------------------
interface CategoryCardProps {
  cat: QuizCategory
  bracketSize: BracketSize
  onBracketSizeChange: (size: BracketSize) => void
  starting: boolean
  onStart: () => void
  onResume: () => void
}

function CategoryCard({
  cat,
  bracketSize,
  onBracketSizeChange,
  starting,
  onStart,
  onResume,
}: CategoryCardProps) {
  const { t } = useTranslation()
  const cfg = CAT_BG[cat.id] ?? DEFAULT_BG
  const active = cat.active_session
  const [showSizes, setShowSizes] = useState(false)

  const validSizes = BRACKET_SIZES.filter((s) => s <= cat.max_items)

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group hover:scale-[1.015] transition-transform duration-300">
      {/* Background poster */}
      {cfg.img && (
        <img
          src={cfg.img}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-500 scale-105 group-hover:scale-100"
          aria-hidden
        />
      )}

      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient}`} />

      {/* Content */}
      <div className="relative z-10 p-5 flex flex-col gap-4" style={{ minHeight: '280px' }}>
        {/* Top: accent dot + media type */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cfg.accent}`} />
            <span className="text-white/60 text-xs font-medium uppercase tracking-wider">
              {t(`quiz.media${cat.media_type.charAt(0).toUpperCase() + cat.media_type.slice(1)}`)}
            </span>
          </div>
          {active && (
            <span className="text-xs text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded-full border border-orange-500/30 font-medium">
              Devam ediyor
            </span>
          )}
        </div>

        {/* Title */}
        <div className="flex-1">
          <h3
            className="text-2xl sm:text-3xl font-black text-white leading-tight mb-1"
            style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.04em' }}
          >
            {cat.label_tr}
          </h3>
          <p className="text-white/50 text-xs">
            {bracketSize} içerik · {bracketSize - 1} maçup
          </p>
        </div>

        {/* Bracket size selector */}
        <div className="relative">
          <button
            onClick={() => setShowSizes((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold transition"
          >
            <span>🏆 {bracketSize} Oyuncu</span>
            <ChevronDown size={14} className={`transition-transform ${showSizes ? 'rotate-180' : ''}`} />
          </button>
          {showSizes && (
            <div className="absolute bottom-full mb-1 left-0 right-0 rounded-lg overflow-hidden border border-white/20 bg-[#111] shadow-2xl z-20">
              {validSizes.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    onBracketSizeChange(size)
                    setShowSizes(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 text-sm transition',
                    size === bracketSize
                      ? 'bg-[var(--color-brand)]/80 text-white font-bold'
                      : 'text-white/70 hover:bg-white/10',
                  ].join(' ')}
                >
                  {size} Oyuncu · {size - 1} maçup
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {active && (
            <button
              id={`bircerank-resume-${cat.id}`}
              onClick={onResume}
              disabled={starting}
              className="w-full py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {starting ? t('common.loading') : `↩ Devam et (Tur ${active.current_round})`}
            </button>
          )}
          <button
            id={`bircerank-start-${cat.id}`}
            onClick={onStart}
            disabled={starting}
            className={[
              'w-full py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-50',
              active
                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                : 'bg-[var(--color-brand)] text-white hover:opacity-90 shadow-lg shadow-[var(--color-brand)]/40',
            ].join(' ')}
          >
            {starting ? t('common.loading') : active ? '+ Yeni Turnuva' : t('quiz.startNew')}
          </button>
        </div>
      </div>
    </div>
  )
}
