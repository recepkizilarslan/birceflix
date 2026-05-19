import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { FilterPanel, DEFAULT_FILTERS, countActiveFilters, isTvMedia, type FilterState, type MediaType } from '../components/FilterPanel'
import { SaveFilterDialog } from '../components/SaveFilterDialog'
import { SearchBar } from '../components/SearchBar'
import { DiscoverCard, type DiscoverCardItem } from '../components/DiscoverCard'
import { discover, search, type TmdbMovie } from '../lib/api'
import { discoverTv, searchTv, type TmdbTvShow } from '../lib/tv'
import { mediaKey } from '../lib/watched'
import { SORT_OPTIONS, TV_SORT_OPTIONS } from '../lib/constants'
import { parseDiscoverUrl, serializeDiscoverUrl, type DiscoverUrlState } from '../lib/discoverUrl'
import { useRegion } from '../lib/preferences'
import {
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
  type SavedFilter,
} from '../lib/savedFilters'

// Combined movie + TV discover. The URL is the single source of truth for
// every user-visible knob (media type, filters, search query, page) so links
// are shareable e-commerce-style. State updates go through `update()` which
// re-serializes the merged state back to search params. Filters that don't
// translate across the movie↔TV boundary are stripped when the user crosses it.
export function Discover() {
  const { t } = useTranslation()
  const { user, watchedKeys, toggleWatched, watchlistKeys, toggleWatchlist } = useOutletContext<LayoutContext>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [region] = useRegion()

  // Derive all user-facing state from the URL. `searchParams.toString()` is
  // the stable identity we react to; the parsed object itself is fresh each
  // render but only the string drives effects.
  const urlKey = searchParams.toString()
  const parsed = useMemo<DiscoverUrlState>(
    () => parseDiscoverUrl(searchParams, region),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urlKey, region],
  )
  const { mediaType, filters, query: searchQuery, page } = parsed

  const update = (next: Partial<DiscoverUrlState>) => {
    setSearchParams(serializeDiscoverUrl({ ...parsed, ...next }), { replace: true })
  }

  const setMediaType = (next: MediaType) => {
    // Only reset filters that don't translate when we cross the movie↔TV
    // boundary. Switching within the same family (movie↔doc) keeps the
    // user's genre/provider/sort choices intact.
    let nextFilters = filters
    if (isTvMedia(next) !== isTvMedia(mediaType)) {
      nextFilters = {
        ...filters,
        with_genres: [],
        with_watch_providers: [],
        sort_by: DEFAULT_FILTERS.sort_by,
      }
    }
    update({ mediaType: next, filters: nextFilters, query: null, page: 1 })
  }

  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  const [results, setResults] = useState<(TmdbMovie | TmdbTvShow)[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(1)

  // Lock body scroll while a bottom sheet is open so the page underneath
  // doesn't move when the user pans the sheet.
  useEffect(() => {
    const anyOpen = filterSheetOpen || sortSheetOpen
    if (!anyOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [filterSheetOpen, sortSheetOpen])

  // Fetch results whenever the URL changes. Debounced so rapid filter edits
  // (year-input typing, range slider drags) coalesce into one request. The
  // controller short-circuits stale responses if a newer URL change arrives
  // before the in-flight request resolves.
  useEffect(() => {
    const ctrl = { cancelled: false }
    const tid = setTimeout(async () => {
      setLoading(true); setErr(null)
      try {
        const data = searchQuery
          ? await (isTvMedia(mediaType) ? searchTv(searchQuery, page) : search(searchQuery, page))
          : await runDiscoverRequest(mediaType, filters, page)
        if (ctrl.cancelled) return
        setResults(data.results)
        setTotalPages(Math.min(data.total_pages, 500))
      } catch (e: any) {
        if (!ctrl.cancelled) setErr(e?.message ?? String(e))
      } finally {
        if (!ctrl.cancelled) setLoading(false)
      }
    }, 250)
    return () => { ctrl.cancelled = true; clearTimeout(tid) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey])

  const onReset = () => update({
    filters: { ...DEFAULT_FILTERS, watch_region: filters.watch_region },
    page: 1,
  })
  const activeCount = countActiveFilters(filters)
  const sortOptions = isTvMedia(mediaType) ? TV_SORT_OPTIONS : SORT_OPTIONS

  // Load saved filter snapshots once the user is signed in. The list mutates
  // locally via the save / delete handlers below — no refetch on every tweak.
  useEffect(() => {
    if (!user) {
      setSavedFilters([])
      return
    }
    listSavedFilters().then(setSavedFilters).catch(() => {})
  }, [user])

  const handleSaveCurrent = async ({ name, description }: { name: string; description: string | null }) => {
    const created = await createSavedFilter({
      name,
      description,
      media_type: mediaType,
      filters,
    })
    setSavedFilters((prev) => [created, ...prev])
  }

  const handleApplySaved = (s: SavedFilter) => {
    update({ mediaType: s.media_type, filters: s.filters, query: null, page: 1 })
    setFilterSheetOpen(false)
  }

  const handleDeleteSaved = async (s: SavedFilter) => {
    if (!window.confirm(t('savedFilters.confirmDelete', { name: s.name }))) return
    await deleteSavedFilter(s.id)
    setSavedFilters((prev) => prev.filter((x) => x.id !== s.id))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <FilterPanel
          value={filters}
          onChange={(next) => update({ filters: next, page: 1 })}
          onReset={onReset}
          activeCount={activeCount}
          mediaType={mediaType}
          onMediaTypeChange={setMediaType}
          savedFilters={user ? savedFilters : undefined}
          onSaveCurrent={user ? () => setSaveDialogOpen(true) : undefined}
          onApplySaved={user ? handleApplySaved : undefined}
          onDeleteSaved={user ? handleDeleteSaved : undefined}
        />
      </aside>

      {/* Content */}
      <div className="space-y-4 min-w-0">
        <SearchBar
          value={searchQuery ?? ''}
          onSearch={(q) => update({ query: q, page: 1 })}
          onClear={() => update({ query: null, page: 1 })}
        />

        {/* Mobile media-type segmented control — quick switch between Film/Dizi/Belgesel. */}
        <div className="lg:hidden flex gap-1.5 p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          {(['movie', 'tv', 'doc'] as MediaType[]).map((mt) => {
            const active = mediaType === mt
            return (
              <button
                key={mt}
                onClick={() => setMediaType(mt)}
                className={`flex-1 text-sm py-2 rounded-lg transition font-medium ${
                  active
                    ? 'bg-[var(--color-accent)] text-black'
                    : 'text-[var(--color-text-dim)] hover:text-white'
                }`}
              >
                {t(`filters.mediaTypes.${mt}`)}
              </button>
            )
          })}
        </div>

        {/* Mobile toolbar — sticky Filtrele / Sırala buttons (e-commerce style). */}
        <div className="lg:hidden sticky top-14 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)]">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterSheetOpen(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium active:scale-[0.98] transition"
            >
              <FilterIcon />
              {t('filters.title')}
              {activeCount > 0 && (
                <span className="text-[11px] px-1.5 min-w-[18px] h-[18px] rounded-full bg-[var(--color-accent)] text-black font-semibold inline-flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setSortSheetOpen(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium active:scale-[0.98] transition"
            >
              <SortIcon />
              {t('sort.label')}
            </button>
          </div>
        </div>

        {/* Desktop toolbar: results count + sort. */}
        <div className="hidden lg:flex items-center justify-between gap-3 flex-wrap">
          {searchQuery && (
            <div className="text-sm text-[var(--color-text-dim)]">{t('discover.searchResults', { query: searchQuery })}</div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            {results.length > 0 && !loading && (
              <div className="text-xs text-[var(--color-text-dim)]">
                {t('discover.results', { count: results.length, page })}
              </div>
            )}
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-dim)]">
              <span>{t('sort.label')}</span>
              <select
                value={filters.sort_by}
                onChange={(e) => update({ filters: { ...filters, sort_by: e.target.value }, page: 1 })}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)] min-w-[160px]"
              >
                {sortOptions.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Mobile result count + search query line — outside sticky so it scrolls away. */}
        <div className="lg:hidden flex items-center justify-between text-xs text-[var(--color-text-dim)]">
          {searchQuery
            ? <span className="truncate">{t('discover.searchResults', { query: searchQuery })}</span>
            : <span />}
          {results.length > 0 && !loading && (
            <span className="shrink-0 ml-2">{t('discover.results', { count: results.length, page })}</span>
          )}
        </div>

        {err && <div className="text-red-400 text-sm">{err}</div>}
        {loading && <div className="text-center text-[var(--color-text-dim)] py-10">{t('common.loading')}</div>}
        {!loading && results.length === 0 && (
          <div className="text-center text-[var(--color-text-dim)] py-10">
            {t('common.noResults')}{' '}
            {activeCount > 0 && <button onClick={onReset} className="text-[var(--color-accent)] underline">{t('discover.clearFilters')}</button>}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-4">
          {(isTvMedia(mediaType)
            ? (results as TmdbTvShow[]).map((s): DiscoverCardItem => ({
                id: s.id,
                media_type: 'tv',
                title: s.name,
                poster_path: s.poster_path,
                vote_average: s.vote_average,
                date: s.first_air_date ?? null,
                meta: (
                  <>
                    {s.number_of_seasons != null && (
                      <span>{t('tv.seasonsLabel', { count: s.number_of_seasons })}</span>
                    )}
                    {s.number_of_seasons != null && s.number_of_episodes != null && <span>·</span>}
                    {s.number_of_episodes != null && (
                      <span>{t('tv.episodesLabel', { count: s.number_of_episodes })}</span>
                    )}
                  </>
                ),
              }))
            : (results as TmdbMovie[]).map((m): DiscoverCardItem => ({
                id: m.id,
                media_type: 'movie',
                title: m.title,
                poster_path: m.poster_path,
                vote_average: m.vote_average,
                date: m.release_date ?? null,
              }))
          ).map((item) => {
            const k = mediaKey(item.media_type, item.id)
            return (
              <DiscoverCard
                key={k}
                item={item}
                onOpen={(it) => navigate(it.media_type === 'tv' ? `/tv/${it.id}` : `/movie/${it.id}`)}
                onToggleWatched={user ? toggleWatched : null}
                watched={watchedKeys.has(k)}
                onToggleWatchlist={user ? toggleWatchlist : null}
                inWatchlist={watchlistKeys.has(k)}
              />
            )
          })}
        </div>

        {results.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-6">
            <PageBtn disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
              {t('common.previous')}
            </PageBtn>
            <div className="text-sm text-[var(--color-text-dim)]">{t('common.pageOf', { page, total: totalPages })}</div>
            <PageBtn disabled={page >= totalPages} onClick={() => update({ page: page + 1 })}>
              {t('common.next')}
            </PageBtn>
          </div>
        )}
      </div>

      {/* ───────── Mobile filter bottom-sheet ───────── */}
      {filterSheetOpen && (
        <BottomSheet
          title={t('filters.title')}
          onClose={() => setFilterSheetOpen(false)}
          footer={
            <div className="flex gap-2">
              <button
                onClick={() => { onReset() }}
                disabled={activeCount === 0}
                className="flex-1 h-12 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium disabled:opacity-40"
              >
                {t('filters.clear')}
              </button>
              <button
                onClick={() => setFilterSheetOpen(false)}
                className="flex-[2] h-12 rounded-xl bg-[var(--color-accent)] text-black text-sm font-semibold active:scale-[0.98] transition"
              >
                {results.length > 0
                  ? t('filters.applyCount', { count: results.length, defaultValue: t('filters.apply') })
                  : t('filters.apply')}
              </button>
            </div>
          }
        >
          <FilterPanel
            value={filters}
            onChange={(next) => update({ filters: next, page: 1 })}
            onReset={onReset}
            activeCount={activeCount}
            mediaType={mediaType}
            onMediaTypeChange={setMediaType}
            savedFilters={user ? savedFilters : undefined}
            onSaveCurrent={user ? () => setSaveDialogOpen(true) : undefined}
            onApplySaved={user ? handleApplySaved : undefined}
            onDeleteSaved={user ? handleDeleteSaved : undefined}
          />
        </BottomSheet>
      )}

      <SaveFilterDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSaveCurrent}
      />

      {/* ───────── Mobile sort bottom-sheet ───────── */}
      {sortSheetOpen && (
        <BottomSheet
          title={t('sort.label')}
          onClose={() => setSortSheetOpen(false)}
        >
          <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
            {sortOptions.map((s) => {
              const active = filters.sort_by === s.value
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    update({ filters: { ...filters, sort_by: s.value }, page: 1 })
                    setSortSheetOpen(false)
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm border-b border-[var(--color-border)] last:border-b-0 transition ${
                    active ? 'text-[var(--color-text)] bg-[var(--color-surface-2)]' : 'text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]/60'
                  }`}
                >
                  <span>{t(s.labelKey)}</span>
                  {active && <span className="text-[var(--color-accent)] text-base">✓</span>}
                </button>
              )
            })}
          </div>
        </BottomSheet>
      )}
    </div>
  )
}

function PageBtn({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="text-sm px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] disabled:opacity-40 hover:border-[var(--color-accent)]"
    >
      {children}
    </button>
  )
}

/** Mobile bottom-sheet modal (lg:hidden) — covers ~90vh, scrollable body,
 *  optional sticky footer for primary actions (Apply / Clear). */
function BottomSheet({
  title, children, footer, onClose,
}: {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      <div
        className="relative w-full max-h-[90vh] flex flex-col bg-[var(--color-bg)] rounded-t-2xl border-t border-[var(--color-border)] shadow-2xl animate-slideUp"
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="h-1.5 w-12 rounded-full bg-[var(--color-border)]" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="close"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-surface)] text-base"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {children}
        </div>
        {footer && (
          <div className="border-t border-[var(--color-border)] p-3 pb-safe bg-[var(--color-bg)]">
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .animate-fadeIn { animation: fadeIn .18s ease-out }
        .animate-slideUp { animation: slideUp .24s cubic-bezier(.2,.8,.2,1) }
      `}</style>
    </div>
  )
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}
function SortIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6"  x2="13" y2="6" />
      <line x1="3" y1="12" x2="11" y2="12" />
      <line x1="3" y1="18" x2="9"  y2="18" />
      <polyline points="17 6 17 18 21 14" />
      <line x1="17" y1="6" x2="17" y2="18" />
    </svg>
  )
}

/** Build and dispatch a /discover request for the given media type. Movies vs
 *  TV hit different TMDB endpoints with different optional params; the
 *  documentary category re-uses /discover/movie with genre 99 forced. */
async function runDiscoverRequest(mediaType: MediaType, f: FilterState, page: number) {
  if (isTvMedia(mediaType)) {
    return discoverTv({
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
      seasons_from: typeof f.seasons_from === 'number' ? f.seasons_from : undefined,
      seasons_to: typeof f.seasons_to === 'number' ? f.seasons_to : undefined,
      episodes_from: typeof f.episodes_from === 'number' ? f.episodes_from : undefined,
      episodes_to: typeof f.episodes_to === 'number' ? f.episodes_to : undefined,
      sort_by: f.sort_by,
      page,
    })
  }
  // Documentary category forces genre 99 and ignores the user's genre chip
  // selections — the FilterPanel hides the genre section in this mode so
  // that's not confusing.
  const genres = mediaType === 'doc' ? [99] : (f.with_genres.length ? f.with_genres : undefined)
  return discover({
    min_rating: f.min_rating || undefined,
    original_language: f.original_language || undefined,
    origin_country: f.origin_country || undefined,
    with_genres: genres,
    year_from: typeof f.year_from === 'number' ? f.year_from : undefined,
    year_to: typeof f.year_to === 'number' ? f.year_to : undefined,
    with_watch_providers: f.with_watch_providers.length ? f.with_watch_providers : undefined,
    watch_region: f.with_watch_providers.length ? f.watch_region : undefined,
    runtime_from: typeof f.runtime_from === 'number' ? f.runtime_from : undefined,
    runtime_to: typeof f.runtime_to === 'number' ? f.runtime_to : undefined,
    sort_by: f.sort_by,
    page,
  })
}
