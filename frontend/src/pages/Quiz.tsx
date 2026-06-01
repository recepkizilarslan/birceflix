/**
 * BirceRank — 1v1 Tournament Hub
 * 4 views: categories → setup (filter page) → playing → result
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Crown, Check } from 'lucide-react'
import {
  listQuizCategories,
  createQuizSession,
  top,
  getQuizMetadata,
  type QuizCategory,
  type QuizSession,
} from '../lib/api'
import { QuizDuel } from '../components/quiz/QuizDuel'
import { QuizResult } from '../components/quiz/QuizResult'
import { useRegion } from '../lib/preferences'
import { intlLocale } from '../i18n'

type ItemMeta = { title: string; poster_path: string | null; year: string | null }
type ItemMap = Map<number, ItemMeta>
type View = 'categories' | 'setup' | 'playing' | 'result'

// ---------------------------------------------------------------------------
// Filter definitions
// ---------------------------------------------------------------------------
interface FilterPreset {
  id: string
  label: string
  bracket_size: number
  platform_id?: number
  description: string
}

const MOVIE_FILTERS: FilterPreset[] = [
  { id: 'top16',    label: 'Top 16',         bracket_size: 16, description: 'quiz.filterMovies' },
  { id: 'top32',    label: 'Top 32',         bracket_size: 32, description: 'quiz.filterMovies' },
  { id: 'top64',    label: 'Top 64',         bracket_size: 64, description: 'quiz.filterMovies' },
  { id: 'netflix',  label: 'Netflix',        bracket_size: 32, platform_id: 8,   description: 'quiz.filterNetflixMovies' },
  { id: 'prime',    label: 'Prime Video',    bracket_size: 32, platform_id: 9,   description: 'quiz.filterPrimeMovies' },
  { id: 'disney',   label: 'Disney+',        bracket_size: 32, platform_id: 337, description: 'quiz.filterDisneyMovies' },
]
const TV_FILTERS: FilterPreset[] = [
  { id: 'top16',    label: 'Top 16',      bracket_size: 16, description: 'quiz.filterTv' },
  { id: 'top32',    label: 'Top 32',      bracket_size: 32, description: 'quiz.filterTv' },
  { id: 'top64',    label: 'Top 64',      bracket_size: 64, description: 'quiz.filterTv' },
  { id: 'netflix',  label: 'Netflix',     bracket_size: 32, platform_id: 8,   description: 'quiz.filterNetflixTv' },
  { id: 'prime',    label: 'Prime Video', bracket_size: 32, platform_id: 9,   description: 'quiz.filterPrimeTv' },
]
const DOC_FILTERS: FilterPreset[] = [
  { id: 'top16',    label: 'Top 16',  bracket_size: 16, description: 'quiz.filterDocs' },
  { id: 'top32',    label: 'Top 32',  bracket_size: 32, description: 'quiz.filterDocs' },
  { id: 'netflix',  label: 'Netflix', bracket_size: 16, platform_id: 8, description: 'quiz.filterNetflixDocs' },
]
const FILTER_MAP: Record<string, FilterPreset[]> = {
  top_movies: MOVIE_FILTERS,
  top_tv:     TV_FILTERS,
  top_docs:   DOC_FILTERS,
}

// Visual config for category cards
const CAT_CFG: Record<string, { gradient: string; accent: string; img: string }> = {
  top_movies: {
    gradient: 'from-red-950/60 via-red-900/40 to-black/90',
    accent: '#ef4444',
    img: 'https://image.tmdb.org/t/p/w780/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
  },
  top_tv: {
    gradient: 'from-purple-950/60 via-purple-900/40 to-black/90',
    accent: '#a855f7',
    img: 'https://image.tmdb.org/t/p/w780/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
  },
  top_docs: {
    gradient: 'from-teal-950/60 via-teal-900/40 to-black/90',
    accent: '#14b8a6',
    img: 'https://image.tmdb.org/t/p/w780/4ceSkV7cmCon4exXaZwuhW1VdE0.jpg',
  },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function QuizPage() {
  const { t, i18n } = useTranslation()
  const [region] = useRegion()
  const [view, setView] = useState<View>('categories')
  const [categories, setCategories] = useState<QuizCategory[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [catError, setCatError] = useState(false)
  const [selectedCat, setSelectedCat] = useState<QuizCategory | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset | null>(null)
  const [session, setSession] = useState<QuizSession | null>(null)
  const [itemMap, setItemMap] = useState<ItemMap>(new Map())
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    listQuizCategories()
      .then(setCategories)
      .catch(() => setCatError(true))
      .finally(() => setLoadingCats(false))
  }, [])

  const getFilterDescription = (f: FilterPreset | null) => {
    if (!f) return ''
    if (f.description.startsWith('quiz.filter')) {
      return t(f.description, { count: f.bracket_size })
    }
    return t(f.description)
  }

  const buildItemMap = useCallback(async (sess: QuizSession, cat: QuizCategory): Promise<ItemMap> => {
    const map = new Map<number, ItemMeta>()
    const mediaType = cat.media_type === 'doc' ? 'movie' : cat.media_type as 'movie' | 'tv'
    try {
      const snapshot = await top(mediaType, region ?? 'TR')
      for (const item of snapshot.items) {
        map.set(item.id, { title: item.title, poster_path: item.poster_path, year: item.year })
      }
    } catch { /* silent */ }
    const allIds = [
      ...(sess.remaining as number[]),
      ...(sess.eliminated as number[]),
      ...(sess.winnerId != null ? [sess.winnerId] : []),
    ]
    
    // Find missing IDs (e.g. Documentaries or Platform-filtered items not in the generic Top 100 cache)
    const missingIds = allIds.filter(id => !map.has(id))
    
    if (missingIds.length > 0) {
      try {
        const metadata = await getQuizMetadata(missingIds.map(id => ({ id, type: mediaType })))
        for (const meta of metadata) {
          map.set(meta.id, { title: meta.title, poster_path: meta.poster_path, year: meta.year })
        }
      } catch (err) {
        console.warn(`Failed to fetch batch metadata`, err)
      }
      
      // Fallback for any still missing
      for (const id of missingIds) {
        if (!map.has(id)) map.set(id, { title: `#${id}`, poster_path: null, year: null })
      }
    }

    return map
  }, [region])

  const handleCategoryClick = (cat: QuizCategory) => {
    setSelectedCat(cat)
    const filters = FILTER_MAP[cat.id] ?? []
    setSelectedFilter(filters[0] ?? null)
    setView('setup')
  }

  const handleStartSession = useCallback(async (resume: boolean) => {
    if (!selectedCat || !selectedFilter) return
    setStarting(true)
    try {
      const sess = await createQuizSession(selectedCat.id, {
        region: region ?? 'TR',
        ui_language: intlLocale(),
        resume,
        bracket_size: selectedFilter.bracket_size,
        platform_id: selectedFilter.platform_id,
      })
      const map = await buildItemMap(sess, selectedCat)
      setItemMap(map)
      setSession(sess)
      setView(sess.completedAt ? 'result' : 'playing')
    } catch (err) {
      console.error('Failed to start session', err)
      alert(t('quiz.loadError'))
    } finally {
      setStarting(false)
    }
  }, [selectedCat, selectedFilter, region, buildItemMap, t])

  const handleSessionUpdate = useCallback(async (updated: QuizSession) => {
    setSession(updated)
    if (updated.completedAt && updated.winnerId) {
      setItemMap((prev) => {
        if (!prev.has(updated.winnerId!) && updated.winnerTitle) {
          const next = new Map(prev)
          next.set(updated.winnerId!, { title: updated.winnerTitle, poster_path: updated.winnerPosterPath, year: null })
          return next
        }
        return prev
      })
      await new Promise((r) => setTimeout(r, 250))
      setView('result')
    }
  }, [])

  const goToCategories = useCallback(() => {
    setSession(null)
    setItemMap(new Map())
    setSelectedCat(null)
    setSelectedFilter(null)
    setView('categories')
    listQuizCategories().then(setCategories).catch(() => { })
  }, [])

  // ── Playing ──
  if (view === 'playing' && session && selectedCat) {
    return (
      <div className="min-h-[75vh] flex flex-col px-2 sm:px-4">
        <div className="flex items-center justify-between mb-5 pt-1">
          <button onClick={goToCategories} className="flex items-center gap-1.5 text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-sm transition">
            <ArrowLeft size={15} /> {t('common.back')}
          </button>
          <div className="flex items-center gap-2">
            <Crown size={14} className="text-yellow-400" />
            <span className="text-base font-black text-[var(--color-text)]" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.05em' }}>
              BirceRank · {t('quiz.category_' + session.category, { defaultValue: session.categoryLabel })}
            </span>
          </div>
          <div className="w-20" />
        </div>
        <QuizDuel session={session} itemMap={itemMap} mediaType={selectedCat.media_type} onSessionUpdate={handleSessionUpdate} />
      </div>
    )
  }

  // ── Result ──
  if (view === 'result' && session) {
    return (
      <div className="min-h-[75vh] py-4 px-2 sm:px-4">
        <QuizResult session={session} itemMap={itemMap} onPlayAgain={goToCategories} />
      </div>
    )
  }

  // ── Setup ──
  if (view === 'setup' && selectedCat) {
    const cfg = CAT_CFG[selectedCat.id] ?? { gradient: 'from-gray-900 to-black', accent: '#888', img: '', emoji: '🎯' }
    const filters = FILTER_MAP[selectedCat.id] ?? []
    const active = selectedCat.active_session
    const isTr = i18n.language?.startsWith('tr')
    const catLabel = isTr ? selectedCat.label_tr : selectedCat.label_en

    return (
      <div className="max-w-5xl mx-auto py-4 px-2 sm:px-0">
        <button onClick={() => setView('categories')} className="flex items-center gap-1.5 text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-sm transition mb-6">
          <ArrowLeft size={15} /> {t('quiz.categories')}
        </button>

        <div className="grid sm:grid-cols-[1fr_1.2fr] gap-0 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          {/* Left: visual */}
          <div className="relative min-h-[280px] sm:min-h-[420px]">
            {cfg.img && <img src={cfg.img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" aria-hidden />}
            <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient}`} />
            <div className="relative z-10 p-6 flex flex-col justify-end h-full">
              <p className="text-white/50 text-xs font-bold tracking-widest mb-1">
                BIRCERANK · <span className="uppercase">{t('quiz.pageTitle')}</span>
              </p>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.05em' }}>
                {catLabel}
              </h2>
              <p className="text-white/50 text-sm mt-1">
                {getFilterDescription(selectedFilter)}
              </p>
              <div className="flex items-center gap-3 mt-4 text-white/60 text-xs">
                <span>{t('quiz.itemsCount', { count: selectedFilter?.bracket_size ?? '?' })}</span>
                <span>·</span>
                <span>{t('quiz.matchesCount', { count: (selectedFilter?.bracket_size ?? 1) - 1 })}</span>
              </div>
            </div>
          </div>

          {/* Right: config */}
          <div className="bg-[var(--color-surface)] p-6 flex flex-col gap-6">
            {/* Resume banner */}
            {active && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                <div>
                  <p className="text-orange-400 text-sm font-bold">{t('quiz.resumeHint')}</p>
                  <p className="text-white/50 text-xs mt-0.5">{t('quiz.resumeItemsLeft', { round: active.current_round, count: active.remaining_count })}</p>
                </div>
                <button
                  onClick={() => handleStartSession(true)}
                  disabled={starting}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {starting ? '...' : t('quiz.resume')}
                </button>
              </div>
            )}

            {/* Filter presets */}
            <div>
              <p className="text-[var(--color-text-dim)] text-xs font-semibold uppercase tracking-widest mb-3">{t('filters.title')}</p>
              <div className="grid grid-cols-2 gap-2">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilter(f)}
                    className={[
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition',
                      selectedFilter?.id === f.id
                        ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-text)]'
                        : 'border-white/10 hover:border-white/25 text-[var(--color-text-dim)] hover:text-[var(--color-text)]',
                    ].join(' ')}
                  >
                    {selectedFilter?.id === f.id && (
                      <div className="w-4 h-4 rounded-full bg-[var(--color-brand)] flex items-center justify-center shrink-0">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold leading-tight">{f.label}</p>
                      <p className="text-xs opacity-60">{t('quiz.itemsCount', { count: f.bracket_size })}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            {selectedFilter && (
              <div className="px-4 py-3 rounded-xl bg-[var(--color-surface-2)]/60 text-xs text-[var(--color-text-dim)]">
                <span className="font-semibold text-[var(--color-text)]">{selectedFilter.label}</span>
                {' · '}{t('quiz.itemsCount', { count: selectedFilter.bracket_size })} {' · '} {t('quiz.matchesCount', { count: selectedFilter.bracket_size - 1 })}
              </div>
            )}

            {/* Start button */}
            <button
              onClick={() => handleStartSession(false)}
              disabled={starting || !selectedFilter}
              className="mt-auto w-full py-4 rounded-xl bg-[var(--color-brand)] text-white font-black text-lg hover:opacity-90 transition disabled:opacity-50 shadow-lg shadow-[var(--color-brand)]/30"
              style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.08em' }}
            >
              {starting ? t('common.loading') : t('quiz.startBtn')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Category hub ──
  return (
    <div className="max-w-4xl mx-auto py-4 px-2 sm:px-0">
      <div className="text-center mb-10">
        <h1 className="text-5xl sm:text-7xl font-black text-[var(--color-text)] mb-2" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.06em' }}>
          BIRCERANK
        </h1>
        <p className="text-[var(--color-text-dim)] text-sm">{t('quiz.pageSubtitle')}</p>
      </div>

      {loadingCats ? (
        <div className="flex items-center justify-center py-24 text-[var(--color-text-dim)]">
          <svg className="animate-spin mr-2" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {t('common.loading')}
        </div>
      ) : catError ? (
        <p className="text-center text-[var(--color-text-dim)] py-24">{t('quiz.failedLoad')}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-3">
          {categories.map((cat) => {
            const cfg = CAT_CFG[cat.id] ?? { gradient: 'from-gray-900 to-black', accent: '#888', img: '' }
            const active = cat.active_session
            const isTr = i18n.language?.startsWith('tr')
            const catLabel = isTr ? cat.label_tr : cat.label_en
            return (
              <button
                key={cat.id}
                id={`bircerank-cat-${cat.id}`}
                onClick={() => handleCategoryClick(cat)}
                className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl group hover:scale-[1.02] transition-transform duration-300 text-left"
                style={{ minHeight: '340px' }}
              >
                {cfg.img && <img src={cfg.img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500" aria-hidden />}
                <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient}`} />
                <div className="relative z-10 p-6 flex flex-col gap-3 h-full justify-end">
                  <div>
                    <h3 className="text-3xl sm:text-4xl font-black text-white leading-tight" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif', letterSpacing: '0.04em' }}>
                      {catLabel}
                    </h3>
                    <p className="text-white/60 text-sm mt-1">{t('quiz.selectFromItems', { count: cat.max_items })}</p>
                  </div>
                  {active && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-orange-400 bg-orange-500/15 px-2.5 py-1 rounded-full border border-orange-500/30 w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      {t('quiz.resumeBadge', { round: active.current_round })}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-white font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Crown size={14} className="text-yellow-400" />
                    {t('quiz.startTourney')}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
