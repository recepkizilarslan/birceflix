/**
 * QuizPage — Tournament hub.
 *
 * Three views:
 *   1. Category list: "En İyi Filmler (64)" cards — start or resume a session.
 *   2. Active duel: QuizDuel component
 *   3. Result: QuizResult component (champion reveal)
 *
 * Item metadata (title, poster_path, year) is fetched from the top/snapshot
 * endpoint in bulk on session start — no per-vote TMDB calls during gameplay.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Film, Tv, FileVideo, Swords } from 'lucide-react'
import { Link } from 'react-router-dom'
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

// ---------------------------------------------------------------------------
// Page component
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
  const [starting, setStarting] = useState<string | null>(null) // category id being started

  // Fetch category list
  useEffect(() => {
    setLoadingCats(true)
    listQuizCategories()
      .then(setCategories)
      .catch(() => setCatError(true))
      .finally(() => setLoadingCats(false))
  }, [])

  // Build item map from top snapshot (for movies & tv) or just use stored data
  const buildItemMap = useCallback(async (sess: QuizSession, cat: QuizCategory): Promise<ItemMap> => {
    const map = new Map<number, ItemMeta>()
    const mediaType = cat.media_type === 'doc' ? 'movie' : cat.media_type

    try {
      // Use existing top snapshot (cached in backend, no extra TMDB calls)
      const snapshot = await top(mediaType as 'movie' | 'tv', region ?? 'TR')
      for (const item of snapshot.items) {
        map.set(item.id, {
          title: item.title,
          poster_path: item.poster_path,
          year: item.year,
        })
      }
    } catch {
      // Fallback: the session already has winner_title if it's finished; for
      // unknown items we show a placeholder.
    }

    // Ensure all remaining ids have at least a placeholder
    for (const id of [...sess.remaining, ...sess.eliminated]) {
      if (!map.has(id)) {
        map.set(id, { title: `#${id}`, poster_path: null, year: null })
      }
    }

    return map
  }, [region])

  const handleStartOrResume = useCallback(async (cat: QuizCategory, resume: boolean) => {
    setStarting(cat.id)
    try {
      const sess = await createQuizSession(cat.id, {
        region: region ?? 'TR',
        ui_language: intlLocale(),
        resume,
      })

      // Check if it was already completed (edge case: resume of a done session)
      if (sess.completed_at) {
        setSession(sess)
        setView('result')
        setStarting(null)
        return
      }

      const map = await buildItemMap(sess, cat)
      setItemMap(map)
      setSession(sess)
      setView('playing')
    } catch (err) {
      console.error('Failed to start quiz session', err)
      alert(t('quiz.loadError'))
    } finally {
      setStarting(null)
    }
  }, [region, buildItemMap, t])

  const handleSessionUpdate = useCallback(async (updated: QuizSession) => {
    setSession(updated)
    if (updated.completed_at) {
      setView('result')
    }
  }, [])

  const handlePlayAgain = useCallback(() => {
    setSession(null)
    setItemMap(new Map())
    setView('categories')
    // Refresh categories so the "resume" badge updates
    listQuizCategories().then(setCategories).catch(() => {})
  }, [])

  const activeCat = session
    ? categories.find((c) => c.id === session.category) ?? null
    : null

  // ── Render ──
  if (view === 'playing' && session && activeCat) {
    return (
      <div className="min-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              setView('categories')
              listQuizCategories().then(setCategories).catch(() => {})
            }}
            className="flex items-center gap-2 text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-sm transition"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>
          <div className="text-center">
            <p
              className="text-lg font-black text-[var(--color-text)]"
              style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.04em' }}
            >
              {session.category_label}
            </p>
          </div>
          <div className="w-16" /> {/* spacer */}
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

  if (view === 'result' && session) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <QuizResult session={session} onPlayAgain={handlePlayAgain} />
      </div>
    )
  }

  // Category hub
  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Page header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-brand)]/20 to-orange-500/10 mb-4 border border-[var(--color-brand)]/20">
          <Swords size={32} className="text-[var(--color-brand)]" />
        </div>
        <h1
          className="text-4xl sm:text-5xl font-black text-[var(--color-text)] mb-2"
          style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.05em' }}
        >
          {t('quiz.pageTitle')}
        </h1>
        <p className="text-[var(--color-text-dim)] text-base">
          {t('quiz.pageSubtitle')}
        </p>
      </div>

      {/* Category cards */}
      {loadingCats ? (
        <div className="flex items-center justify-center py-20 text-[var(--color-text-dim)]">
          <svg className="animate-spin mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {t('quiz.loading')}
        </div>
      ) : catError ? (
        <p className="text-center text-[var(--color-text-dim)] py-20">{t('quiz.loadError')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              starting={starting === cat.id}
              onStart={() => handleStartOrResume(cat, false)}
              onResume={() => handleStartOrResume(cat, true)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CategoryCard
// ---------------------------------------------------------------------------
const MEDIA_ICONS: Record<QuizMediaType, React.ComponentType<{ size?: number; className?: string }>> = {
  movie: Film,
  tv: Tv,
  doc: FileVideo,
}

const MEDIA_LABELS_MAP: Record<QuizMediaType, string> = {
  movie: 'quiz.mediaMovie',
  tv: 'quiz.mediaTv',
  doc: 'quiz.mediaDoc',
}

const CATEGORY_COLORS: Record<string, string> = {
  top_movies: 'from-red-600/20 to-orange-600/10 border-red-500/30',
  top_tv:     'from-purple-600/20 to-indigo-600/10 border-purple-500/30',
  top_docs:   'from-teal-600/20 to-cyan-600/10 border-teal-500/30',
}

const CATEGORY_ICON_COLORS: Record<string, string> = {
  top_movies: 'text-red-400',
  top_tv:     'text-purple-400',
  top_docs:   'text-teal-400',
}

interface CategoryCardProps {
  cat: QuizCategory
  starting: boolean
  onStart: () => void
  onResume: () => void
}

function CategoryCard({ cat, starting, onStart, onResume }: CategoryCardProps) {
  const { t } = useTranslation()
  const Icon = MEDIA_ICONS[cat.media_type]
  const colorClass = CATEGORY_COLORS[cat.id] ?? 'from-[var(--color-surface-2)]/20 to-transparent border-[var(--color-border)]'
  const iconColor = CATEGORY_ICON_COLORS[cat.id] ?? 'text-[var(--color-brand)]'
  const active = cat.active_session

  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-br p-5 flex flex-col gap-3 ${colorClass} transition-all hover:scale-[1.01]`}
    >
      {/* Icon + Media type badge */}
      <div className="flex items-center justify-between">
        <div className={`p-2.5 rounded-xl bg-black/20 ${iconColor}`}>
          <Icon size={22} />
        </div>
        <span className="text-[11px] text-[var(--color-text-dim)] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)]/60 uppercase tracking-wide font-medium">
          {t(MEDIA_LABELS_MAP[cat.media_type])}
        </span>
      </div>

      {/* Title */}
      <div>
        <h3 className="font-bold text-[var(--color-text)] text-lg leading-tight">
          {cat.label_tr}
        </h3>
        <p className="text-[var(--color-text-dim)] text-xs mt-0.5">
          {t('quiz.items', { count: cat.max_items })}
        </p>
      </div>

      {/* Resume badge */}
      {active && (
        <div className="flex items-center gap-1.5 text-xs text-orange-400 bg-orange-500/10 px-2.5 py-1.5 rounded-lg border border-orange-500/20">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="4" /></svg>
          {t('quiz.resumeBadge', { round: active.current_round })}
          <span className="ml-auto text-[var(--color-text-dim)]">{active.remaining_count} kaldı</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 mt-auto">
        {active && (
          <button
            id={`quiz-resume-${cat.id}`}
            onClick={onResume}
            disabled={starting}
            className="w-full py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            {starting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
                {t('common.loading')}
              </span>
            ) : t('quiz.resume')}
          </button>
        )}
        <button
          id={`quiz-start-${cat.id}`}
          onClick={onStart}
          disabled={starting}
          className={`w-full py-2 rounded-lg font-semibold text-sm transition disabled:opacity-50 ${
            active
              ? 'border border-[var(--color-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]'
              : 'bg-[var(--color-brand)] text-white hover:opacity-90'
          }`}
        >
          {starting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              {t('common.loading')}
            </span>
          ) : active ? t('quiz.startNew') : t('quiz.startNew')}
        </button>
      </div>
    </div>
  )
}
