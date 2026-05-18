import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { FilterPanel, DEFAULT_FILTERS, countActiveFilters, type FilterState } from '../components/FilterPanel'
import { SearchBar } from '../components/SearchBar'
import { MovieCard } from '../components/MovieCard'
import { discover, search, type TmdbMovie } from '../lib/api'

export function Discover() {
  const { t } = useTranslation()
  const { user, watchedIds, toggleWatched } = useOutletContext<LayoutContext>()
  const navigate = useNavigate()

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [results, setResults] = useState<TmdbMovie[]>([])
  const [searchQuery, setSearchQuery] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const runDiscover = useCallback(async (f: FilterState, p = 1) => {
    setLoading(true); setErr(null); setSearchQuery(null)
    try {
      const data = await discover({
        min_rating: f.min_rating || undefined,
        original_language: f.original_language || undefined,
        origin_country: f.origin_country || undefined,
        with_genres: f.with_genres.length ? f.with_genres : undefined,
        year_from: typeof f.year_from === 'number' ? f.year_from : undefined,
        year_to: typeof f.year_to === 'number' ? f.year_to : undefined,
        with_watch_providers: f.with_watch_providers.length ? f.with_watch_providers : undefined,
        watch_region: f.with_watch_providers.length ? f.watch_region : undefined,
        runtime_from: typeof f.runtime_from === 'number' ? f.runtime_from : undefined,
        runtime_to: typeof f.runtime_to === 'number' ? f.runtime_to : undefined,
        sort_by: f.sort_by,
        page: p,
      })
      setResults(data.results)
      setPage(data.page)
      setTotalPages(Math.min(data.total_pages, 500))
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  const runSearch = useCallback(async (q: string, p = 1) => {
    setLoading(true); setErr(null); setSearchQuery(q)
    try {
      const data = await search(q, p)
      setResults(data.results)
      setPage(data.page)
      setTotalPages(Math.min(data.total_pages, 500))
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!searchQuery) {
      const tid = setTimeout(() => runDiscover(filters, 1), 250)
      return () => clearTimeout(tid)
    }
  }, [filters, runDiscover, searchQuery])

  const onReset = () => setFilters(DEFAULT_FILTERS)
  const activeCount = countActiveFilters(filters)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto
          fixed lg:static inset-y-0 left-0 z-50 w-[300px] lg:w-auto
          bg-[var(--color-bg)] lg:bg-transparent
          transform transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
      >
        <div className="lg:hidden flex justify-between items-center p-4 border-b border-[var(--color-border)]">
          <span className="font-semibold">{t('filters.title')}</span>
          <button onClick={() => setMobileOpen(false)} className="text-xl px-2">✕</button>
        </div>
        <div className="p-4 lg:p-0">
          <FilterPanel value={filters} onChange={setFilters} onReset={onReset} activeCount={activeCount} />
        </div>
      </aside>

      {/* Content */}
      <div className="space-y-5 min-w-0">
        <SearchBar
          onSearch={(q) => runSearch(q, 1)}
          onClear={() => { setSearchQuery(null); runDiscover(filters, 1) }}
        />

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-sm px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center gap-2"
          >
            <span>⚙</span> {t('filters.title')}
            {activeCount > 0 && <span className="text-xs px-1.5 rounded-full bg-[var(--color-accent)] text-black font-medium">{activeCount}</span>}
          </button>
          {searchQuery && (
            <div className="text-sm text-[var(--color-text-dim)]">{t('discover.searchResults', { query: searchQuery })}</div>
          )}
          <div className="text-xs text-[var(--color-text-dim)] ml-auto">
            {results.length > 0 && !loading && t('discover.results', { count: results.length, page })}
          </div>
        </div>

        {err && <div className="text-red-400 text-sm">{err}</div>}
        {loading && <div className="text-center text-[var(--color-text-dim)] py-10">{t('common.loading')}</div>}
        {!loading && results.length === 0 && (
          <div className="text-center text-[var(--color-text-dim)] py-10">
            {t('common.noResults')}{' '}
            {activeCount > 0 && <button onClick={onReset} className="text-[var(--color-accent)] underline">{t('discover.clearFilters')}</button>}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
          {results.map((m) => (
            <MovieCard
              key={m.id}
              movie={m}
              watched={watchedIds.has(m.id)}
              canMark={!!user}
              onToggleWatched={toggleWatched}
              onOpen={(mv) => navigate(`/movie/${mv.id}`)}
            />
          ))}
        </div>

        {results.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-6">
            <PageBtn disabled={page <= 1} onClick={() => {
              const p = page - 1
              if (searchQuery) runSearch(searchQuery, p)
              else runDiscover(filters, p)
            }}>{t('common.previous')}</PageBtn>
            <div className="text-sm text-[var(--color-text-dim)]">{t('common.pageOf', { page, total: totalPages })}</div>
            <PageBtn disabled={page >= totalPages} onClick={() => {
              const p = page + 1
              if (searchQuery) runSearch(searchQuery, p)
              else runDiscover(filters, p)
            }}>{t('common.next')}</PageBtn>
          </div>
        )}
      </div>
    </div>
  )
}

function PageBtn({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] disabled:opacity-40 hover:border-[var(--color-accent)]"
    >
      {children}
    </button>
  )
}
