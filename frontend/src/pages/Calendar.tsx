import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { MovieCard } from '../components/MovieCard'
import { getNowPlaying, getUpcoming, type CalendarResponse } from '../lib/calendar'
import { mediaKey } from '../lib/watched'
import { COUNTRIES } from '../lib/constants'
import { useRegion } from '../lib/preferences'
import { fmtDate as intlFmtDate } from '../lib/intl'
import { countryName } from '../lib/intl'
import type { TmdbMovie } from '../lib/api'

type Tab = 'upcoming' | 'now_playing'

function fmtDate(iso: string | undefined): string {
  return intlFmtDate(iso, { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Group movies by their release_date (YYYY-MM-DD), preserving the API's ordering. */
function groupByDate(movies: TmdbMovie[]): { date: string; items: TmdbMovie[] }[] {
  const groups = new Map<string, TmdbMovie[]>()
  const order: string[] = []
  for (const m of movies) {
    const d = m.release_date || '0000-00-00'
    if (!groups.has(d)) {
      groups.set(d, [])
      order.push(d)
    }
    groups.get(d)!.push(m)
  }
  return order.map((d) => ({ date: d, items: groups.get(d)! }))
}

export function CalendarPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user, watchedKeys, toggleWatched } = useOutletContext<LayoutContext>()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [region, setRegion] = useRegion()
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async (t: Tab, p: number, r: string) => {
    setLoading(true); setErr(null)
    try {
      const fn = t === 'upcoming' ? getUpcoming : getNowPlaying
      setData(await fn(p, r))
      setPage(p)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(tab, 1, region) /* eslint-disable-line react-hooks/exhaustive-deps */ }, [tab, region, i18n.language])

  const totalPages = data ? Math.min(data.total_pages, 500) : 1
  const groups = data ? groupByDate(data.results) : []

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('calendar.title')}</h1>
          <p className="text-sm text-[var(--color-text-dim)] mt-1">
            {t('calendar.regionLabel')} <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="bg-transparent border-b border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[var(--color-text)] ml-1"
            >
              {COUNTRIES.filter((c) => c.code).map((c) => <option key={c.code} value={c.code}>{countryName(c.code)}</option>)}
            </select>
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1">
          <TabBtn active={tab === 'upcoming'} onClick={() => setTab('upcoming')}>{t('calendar.tabUpcoming')}</TabBtn>
          <TabBtn active={tab === 'now_playing'} onClick={() => setTab('now_playing')}>{t('calendar.tabNowPlaying')}</TabBtn>
        </div>
      </header>

      {data?.dates && tab === 'upcoming' && (
        <div className="text-xs text-[var(--color-text-dim)]">
          {fmtDate(data.dates.minimum)} → {fmtDate(data.dates.maximum)}
        </div>
      )}

      {err && <div className="text-red-400 text-sm">{err}</div>}
      {loading && <div className="text-center text-[var(--color-text-dim)] py-10">{t('common.loading')}</div>}
      {!loading && data && data.results.length === 0 && (
        <div className="text-center text-[var(--color-text-dim)] py-10">
          {t('calendar.emptyForRegion')}
        </div>
      )}

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.date}>
            <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] mb-3 sticky top-16 bg-[var(--color-bg)]/95 backdrop-blur py-1 z-10">
              {fmtDate(g.date) || t('calendar.unknownDate')} · <span className="text-[var(--color-text-dim)]/70">{g.items.length}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
              {g.items.map((m) => (
                <MovieCard
                  key={m.id}
                  movie={m}
                  watched={watchedKeys.has(mediaKey('movie', m.id))}
                  canMark={!!user}
                  onToggleWatched={(mv) => toggleWatched({ id: mv.id, media_type: 'movie', title: mv.title, poster_path: mv.poster_path })}
                  onOpen={(mv) => navigate(`/movie/${mv.id}`)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-6">
          <PageBtn disabled={page <= 1} onClick={() => load(tab, page - 1, region)}>{t('common.previous')}</PageBtn>
          <div className="text-sm text-[var(--color-text-dim)]">{t('common.page')} {page} / {totalPages}</div>
          <PageBtn disabled={page >= totalPages} onClick={() => load(tab, page + 1, region)}>{t('common.next')}</PageBtn>
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm transition ${active
        ? 'bg-[var(--color-accent)] text-black font-medium'
        : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
        }`}
    >
      {children}
    </button>
  )
}

function PageBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}
