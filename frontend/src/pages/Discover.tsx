import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { FilterPanel, DEFAULT_FILTERS, countActiveFilters, isTvMedia, type FilterState, type MediaType } from '../components/FilterPanel'
import { ProviderStrip } from '../components/ProviderStrip'
import { SaveFilterDialog } from '../components/SaveFilterDialog'
import { SearchBar } from '../components/SearchBar'
import { DiscoverCard, type DiscoverCardItem } from '../components/DiscoverCard'
import { BackToTop } from '../components/BackToTop'
import { intlLocale } from '../i18n'
import { discover, search, top, getContentTitle, type TmdbMovie, type TopItem } from '../lib/api'
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
  const { t, i18n } = useTranslation()
  const { user, watchedKeys, toggleWatched, watchlistKeys, toggleWatchlist } = useOutletContext<LayoutContext>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [region] = useRegion()

  // Derive all user-facing state from the URL. `searchParams.toString()` is
  // the stable identity we react to; the parsed object itself is fresh each
  // render but only the string drives effects.
  const urlKey = searchParams.toString()
  const previousUrlKey = useRef(urlKey)
  useEffect(() => {
    if (previousUrlKey.current !== urlKey) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      previousUrlKey.current = urlKey
    }
  }, [urlKey])

  const parsed = useMemo<DiscoverUrlState>(
    () => parseDiscoverUrl(searchParams, region),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urlKey, region],
  )
  const { mediaType, filters, query: searchQuery } = parsed

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
    // /doc has no top_rated endpoint. Force-clear top_only when crossing
    // into doc so the user doesn't end up with a phantom filter.
    if (next === 'doc' && nextFilters.top_only) {
      nextFilters = { ...nextFilters, top_only: false }
    }
    update({ mediaType: next, filters: nextFilters, query: null })
  }

  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  const [results, setResults] = useState<(TmdbMovie | TmdbTvShow)[]>([])
  /** When non-null, the page is rendering top-rated results (with provider
   * banners) sliced client-side instead of /discover results. Cleared the
   * moment top_only flips off or the user starts searching. */
  const [topResults, setTopResults] = useState<TopItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  /** True while a "load more" page request is in flight. Distinct from
   *  `loading` (initial / filter-change fetch) so the UI can keep the
   *  existing results visible while we tack a new page onto the end. */
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  /** Next TMDB page number to request when the IntersectionObserver fires.
   *  Starts at 2 because the initial fetch grabs page 1. */
  const [nextPage, setNextPage] = useState(2)
  /** TMDB cap is 500; we clamp here so the UI doesn't keep requesting
   *  pages the API refuses. */
  const [totalPagesAvail, setTotalPagesAvail] = useState(1)
  /** Total matching items across all pages — shown prominently above the
   *  grid. Falls back to null only when TMDB omits the field (search
   *  endpoints used to; both /discover variants always include it). */
  const [totalResults, setTotalResults] = useState<number | null>(null)

  // Watch-region is driven exclusively by the header preference now (no
  // separate dropdown inside the Platforms filter). When the user flips
  // the header region we drop the URL's `wr` and clear any provider chips
  // since provider IDs are region-scoped and would silently no-op
  // otherwise.
  useEffect(() => {
    if (filters.watch_region === region) return
    update({
      filters: { ...filters, watch_region: region, with_watch_providers: [] },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region])

  // Lock body scroll while a bottom sheet is open so the page underneath
  // doesn't move when the user pans the sheet.
  useEffect(() => {
    const anyOpen = filterSheetOpen || sortSheetOpen
    if (!anyOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [filterSheetOpen, sortSheetOpen])

  // Generation counter: every URL change (filters / sort / search / media
  // type) bumps it. In-flight `loadMore` calls compare against it and
  // discard their results if a newer URL has won the race, so the
  // accumulator never gets polluted with results from stale filters.
  const fetchGen = useRef(0)

  // Initial fetch on URL change. Debounced so rapid filter edits coalesce
  // into one request. Replaces the whole results array — `loadMore` only
  // appends, never resets.
  useEffect(() => {
    fetchGen.current += 1
    const myGen = fetchGen.current
    setLoading(true)
    setErr(null)
    setResults([])
    setTopResults(null)
    setNextPage(2)
    setTotalPagesAvail(1)
    setTotalResults(null)

    const tid = setTimeout(async () => {
      try {
        // Top mode short-circuits both discover and search — its base list
        // (TMDB top_rated for the current media type, prefetched server-side)
        // is what every other filter narrows. The whole filtered snapshot
        // is rendered at once; there's nothing more to lazy-load.
        if (filters.top_only && !searchQuery && mediaType !== 'doc') {
          const snap = await top(isTvMedia(mediaType) ? 'tv' : 'movie', filters.watch_region)
          if (fetchGen.current !== myGen) return
          const filtered = applyTopFilters(snap.items, filters, mediaType)
          setTopResults(filtered)
          setResults([])
          setTotalPagesAvail(1)
          setTotalResults(filtered.length)
          return
        }

        const data = searchQuery
          ? await (isTvMedia(mediaType) ? searchTv(searchQuery, 1) : search(searchQuery, 1))
          : await runDiscoverRequest(mediaType, filters, 1)
        if (fetchGen.current !== myGen) return
        setResults(data.results)
        setTotalPagesAvail(Math.min(data.total_pages, 500))
        // total_results is on every /discover response; search endpoints
        // sometimes omit it, so fall back to the page-local length so the
        // banner still has a number to show.
        const tr = (data as { total_results?: number }).total_results
        setTotalResults(typeof tr === 'number' ? tr : data.results.length)
      } catch (e: any) {
        if (fetchGen.current === myGen) setErr(e?.message ?? String(e))
      } finally {
        if (fetchGen.current === myGen) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(tid) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey, i18n.language])

  // Append the next TMDB page onto `results`. Called from the
  // IntersectionObserver attached to the sentinel below the grid.
  // Bails early when nothing more is available, or when an initial /
  // load-more request is already in flight.
  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return
    if (topResults) return  // top mode is a one-shot client-side render
    if (nextPage > totalPagesAvail) return

    const myGen = fetchGen.current
    setLoadingMore(true)
    try {
      const data = searchQuery
        ? await (isTvMedia(mediaType) ? searchTv(searchQuery, nextPage) : search(searchQuery, nextPage))
        : await runDiscoverRequest(mediaType, filters, nextPage)
      if (fetchGen.current !== myGen) return
      setResults((prev) => [...prev, ...data.results])
      setNextPage((p) => p + 1)
    } catch {
      // Lazy-load failure is non-fatal — let the next intersection retry.
      // We deliberately don't surface this as a banner error so a flaky
      // page-5 fetch doesn't blow away the user's view of pages 1-4.
    } finally {
      if (fetchGen.current === myGen) setLoadingMore(false)
    }
  }, [loading, loadingMore, topResults, nextPage, totalPagesAvail, searchQuery, mediaType, filters])

  // IntersectionObserver on a sentinel div below the grid. The ref pattern
  // keeps the observer instance stable while still calling the latest
  // closure of loadMore (which depends on the current filters / page).
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef(loadMore)
  useEffect(() => { loadMoreRef.current = loadMore }, [loadMore])
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMoreRef.current()
    }, { rootMargin: '600px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const hasMore = !topResults && nextPage <= totalPagesAvail
  const numberFmt = useMemo(() => new Intl.NumberFormat(intlLocale()), [i18n.language])

  const onReset = () => update({
    filters: { ...DEFAULT_FILTERS, watch_region: filters.watch_region },
  })
  const activeCount = countActiveFilters(filters)
  const sortOptions = isTvMedia(mediaType) ? TV_SORT_OPTIONS : SORT_OPTIONS

  // /api/discover and /api/tv/discover apply watched_filter server-side
  // now (see the audit notes on PR #X). The discover results we get back
  // are already filtered for the active mode, with the correct pagination
  // count — no client-side post-filter needed.
  //
  // The exception is "top" mode: that uses the prefetched top-rated
  // snapshot, not the discover endpoint, so the snapshot still needs a
  // local intersection with watchedKeys.
  const wf = filters.watched_filter
  const visibleResults = results
  const visibleTopResults = useMemo(() => {
    if (wf === 'all' || !topResults) return topResults
    const mt: 'movie' | 'tv' = isTvMedia(mediaType) ? 'tv' : 'movie'
    return topResults.filter((r) => {
      const isWatched = watchedKeys.has(mediaKey(mt, r.id))
      return wf === 'watched' ? isWatched : !isWatched
    })
  }, [topResults, wf, watchedKeys, mediaType])

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
    update({ mediaType: s.media_type, filters: s.filters, query: null })
    setFilterSheetOpen(false)
  }

  const handleDeleteSaved = async (s: SavedFilter) => {
    if (!window.confirm(t('savedFilters.confirmDelete', { name: s.name }))) return
    await deleteSavedFilter(s.id)
    setSavedFilters((prev) => prev.filter((x) => x.id !== s.id))
  }

  const toggleProvider = (id: number) => {
    const nextProviders = filters.with_watch_providers.includes(id)
      ? filters.with_watch_providers.filter((x) => x !== id)
      : [...filters.with_watch_providers, id]
    update({ filters: { ...filters, with_watch_providers: nextProviders } })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <FilterPanel
          value={filters}
          onChange={(next) => update({ filters: next })}
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
          onSearch={(q) => update({ query: q })}
          onClear={() => update({ query: null })}
          mediaType={mediaType}
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

        {/* Platform quick-filter strip — every provider TMDB lists for the
            active region (sorted by display_priority). Tapping a tile toggles
            it in the same with_watch_providers URL filter the sidebar uses. */}
        <ProviderStrip
          mediaType={mediaType}
          region={filters.watch_region}
          selected={filters.with_watch_providers}
          onToggle={toggleProvider}
        />

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

        {/* Desktop toolbar: results count + sort. The count is always
            rendered (even while loading or with zero matches) so the
            user sees the size of the catalog they're filtering against. */}
        <div className="hidden lg:flex items-center justify-between gap-3 flex-wrap">
          {searchQuery && (
            <div className="text-sm text-[var(--color-text-dim)]">{t('discover.searchResults', { query: searchQuery })}</div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            {totalResults != null && (
              <div className="text-sm font-medium text-[var(--color-text)]">
                {t('discover.results', { total: numberFmt.format(totalResults) })}
              </div>
            )}
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-dim)]">
              <span>{t('sort.label')}</span>
              <select
                value={filters.sort_by}
                onChange={(e) => update({ filters: { ...filters, sort_by: e.target.value } })}
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
        <div className="lg:hidden flex items-center justify-between text-xs">
          {searchQuery
            ? <span className="truncate text-[var(--color-text-dim)]">{t('discover.searchResults', { query: searchQuery })}</span>
            : <span />}
          {totalResults != null && (
            <span className="shrink-0 ml-2 font-medium text-[var(--color-text)]">
              {t('discover.results', { total: numberFmt.format(totalResults) })}
            </span>
          )}
        </div>

        {err && <div className="text-red-400 text-sm">{err}</div>}
        {loading && <div className="text-center text-[var(--color-text-dim)] py-10">{t('common.loading')}</div>}
        {!loading && (visibleTopResults ? visibleTopResults.length === 0 : visibleResults.length === 0) && (
          <div className="text-center text-[var(--color-text-dim)] py-10">
            {t('common.noResults')}{' '}
            {activeCount > 0 && <button onClick={onReset} className="text-[var(--color-accent)] underline">{t('discover.clearFilters')}</button>}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-4">
          {visibleTopResults
            ? visibleTopResults.map((it) => {
                const cardItem: DiscoverCardItem = {
                  id: it.id,
                  media_type: isTvMedia(mediaType) ? 'tv' : 'movie',
                  title: it.title,
                  poster_path: it.poster_path,
                  vote_average: it.vote_average,
                  date: it.year ? `${it.year}-01-01` : null,
                  meta: <span className="font-semibold text-[var(--color-text)]">#{it.rank}</span>,
                }
                const k = mediaKey(cardItem.media_type, cardItem.id)
                return (
                  <DiscoverCard
                    key={k}
                    item={cardItem}
                    onOpen={(c) => navigate(c.media_type === 'tv' ? `/tv/${c.id}` : `/movie/${c.id}`)}
                    onToggleWatched={user ? toggleWatched : null}
                    watched={watchedKeys.has(k)}
                    onToggleWatchlist={user ? toggleWatchlist : null}
                    inWatchlist={watchlistKeys.has(k)}
                    providerBanner={it.providers}
                  />
                )
              })
            : (isTvMedia(mediaType)
                ? (visibleResults as TmdbTvShow[]).map((s): DiscoverCardItem => ({
                    id: s.id,
                    media_type: 'tv',
                    title: getContentTitle(s),
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
                : (visibleResults as TmdbMovie[]).map((m): DiscoverCardItem => ({
                    id: m.id,
                    media_type: 'movie',
                    title: getContentTitle(m),
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

        {/* Infinite-scroll sentinel + loading footer. The 600px rootMargin
            on the observer (above) means the next page kicks off well
            before the user hits the bottom, so the new cards stream in
            without a visible pause. The sentinel always renders so the
            observer stays attached even after the very first page. */}
        <div ref={sentinelRef} aria-hidden="true" className="h-px" />
        {loadingMore && (
          <div className="py-6 text-center text-sm text-[var(--color-text-dim)]">
            {t('common.loadingMore')}
          </div>
        )}
        {!loadingMore && !loading && !hasMore && totalResults != null && visibleResults.length > 0 && (
          <div className="py-6 text-center text-xs text-[var(--color-text-dim)]">
            {t('discover.loadedOf', {
              loaded: numberFmt.format(visibleResults.length),
              total: numberFmt.format(totalResults),
            })}
          </div>
        )}
      </div>

      {/* Floating "back to top" button. Hidden while a bottom sheet is open
          so it doesn't poke through the modal overlay. */}
      <BackToTop hidden={filterSheetOpen || sortSheetOpen} />

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
                {visibleResults.length > 0
                  ? t('filters.applyCount', { count: visibleResults.length, defaultValue: t('filters.apply') })
                  : t('filters.apply')}
              </button>
            </div>
          }
        >
          <FilterPanel
            value={filters}
            onChange={(next) => update({ filters: next })}
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
                    update({ filters: { ...filters, sort_by: s.value } })
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

/** Filter the prefetched top-rated list client-side. The snapshot now
 *  carries everything Discover's filter panel exposes — rating, year,
 *  genre, language, country, runtime (movies), season/episode counts (TV)
 *  and providers — so all of them narrow the 250 the same way the
 *  /discover endpoint would. The sort selector is still ignored: top mode
 *  is implicitly ranked by TMDB rating. */
function applyTopFilters(items: TopItem[], f: FilterState, mediaType: MediaType): TopItem[] {
  const tv = isTvMedia(mediaType)
  return items.filter((it) => {
    if (f.min_rating > 0 && it.vote_average < f.min_rating) return false
    if (typeof f.year_from === 'number' && (it.year == null || Number(it.year) < f.year_from)) return false
    if (typeof f.year_to === 'number' && (it.year == null || Number(it.year) > f.year_to)) return false
    if (f.with_genres.length > 0 && !it.genre_ids.some((g) => f.with_genres.includes(g))) return false
    if (f.with_watch_providers.length > 0 && !it.providers.some((p) => f.with_watch_providers.includes(p.provider_id))) return false
    if (f.original_language && it.original_language !== f.original_language) return false
    // The Country filter uses iso codes (e.g. "IN") in the URL; the cache
    // also stores them uppercase. Direct equality is enough.
    if (f.origin_country && it.origin_country !== f.origin_country) return false
    if (!tv) {
      if (typeof f.runtime_from === 'number' && (it.runtime == null || it.runtime < f.runtime_from)) return false
      if (typeof f.runtime_to === 'number' && (it.runtime == null || it.runtime > f.runtime_to)) return false
    } else {
      if (typeof f.seasons_from === 'number' && (it.number_of_seasons == null || it.number_of_seasons < f.seasons_from)) return false
      if (typeof f.seasons_to === 'number' && (it.number_of_seasons == null || it.number_of_seasons > f.seasons_to)) return false
      if (typeof f.episodes_from === 'number' && (it.number_of_episodes == null || it.number_of_episodes < f.episodes_from)) return false
      if (typeof f.episodes_to === 'number' && (it.number_of_episodes == null || it.number_of_episodes > f.episodes_to)) return false
    }
    return true
  })
}

/** Build and dispatch a /discover request for the given media type. Movies vs
 *  TV hit different TMDB endpoints with different optional params; the
 *  documentary category re-uses /discover/movie with genre 99 forced.
 *  `watched_filter` is forwarded as-is — the backend resolves it against
 *  the user's watched_movies table (see backend/src/routes/discover.ts). */
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
      watched_filter: f.watched_filter,
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
    watched_filter: f.watched_filter,
  })
}
