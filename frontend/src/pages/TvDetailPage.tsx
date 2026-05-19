import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { tvDetail, tvSeason, type TvDetail, type TvSeasonDetail } from '../lib/tv'
import { poster } from '../lib/api'
import { fmtDate } from '../lib/intl'
import { mediaKey } from '../lib/watched'
import {
  listWatchedEpisodes,
  markEpisode,
  markSeason,
  unmarkEpisode,
  unmarkSeason,
} from '../lib/episodes'

function episodeKey(s: number, e: number): string {
  return `${s}.${e}`
}

export function TvDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    user,
    watchedKeys: showWatchedKeys,
    watchlistKeys: showWatchlistKeys,
    toggleWatched,
    toggleWatchlist,
  } = useOutletContext<LayoutContext>()

  const [show, setShow] = useState<TvDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  /** Set of watched-episode keys ("season.episode") — fast .has() during render. */
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set())

  // Per-season loaded episodes — lazy: load on accordion open.
  const [seasons, setSeasons] = useState<Map<number, TvSeasonDetail>>(new Map())
  const [openSeason, setOpenSeason] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    setShow(null); setErr(null); setWatchedKeys(new Set()); setSeasons(new Map()); setOpenSeason(null)
    const showId = Number(id)
    tvDetail(showId).then(setShow).catch((e) => setErr(e.message))
    if (user) {
      listWatchedEpisodes(showId)
        .then((rows) => setWatchedKeys(new Set(rows.map((r) => episodeKey(r.season_number, r.episode_number)))))
        .catch(() => {})
    }
  }, [id, user])

  const loadSeason = async (n: number) => {
    if (!show || seasons.has(n)) {
      setOpenSeason((cur) => (cur === n ? null : n))
      return
    }
    try {
      const data = await tvSeason(show.id, n)
      setSeasons((prev) => new Map(prev).set(n, data))
      setOpenSeason(n)
    } catch (e: any) {
      setErr(e.message ?? 'season load failed')
    }
  }

  const toggleEpisode = async (s: number, ep: { episode_number: number; name?: string | null }) => {
    if (!show || !user) return
    const key = episodeKey(s, ep.episode_number)
    const wasWatched = watchedKeys.has(key)
    // Optimistic update
    setWatchedKeys((prev) => {
      const next = new Set(prev)
      if (wasWatched) next.delete(key); else next.add(key)
      return next
    })
    try {
      if (wasWatched) {
        await unmarkEpisode(show.id, s, ep.episode_number)
      } else {
        await markEpisode({
          show_id: show.id,
          show_name: show.name,
          show_poster_path: show.poster_path,
          season_number: s,
          episode_number: ep.episode_number,
          episode_name: ep.name ?? null,
        })
      }
    } catch (e: any) {
      // Roll back on error
      setWatchedKeys((prev) => {
        const next = new Set(prev)
        if (wasWatched) next.add(key); else next.delete(key)
        return next
      })
      alert(e.message ?? 'failed')
    }
  }

  const toggleSeason = async (season: TvSeasonDetail) => {
    if (!show || !user) return
    const allMarked = season.episodes.every((e) => watchedKeys.has(episodeKey(season.season_number, e.episode_number)))
    if (allMarked) {
      if (!confirm(t('tv.confirmRemoveSeason', { n: season.season_number }))) return
      try {
        await unmarkSeason(show.id, season.season_number)
        setWatchedKeys((prev) => {
          const next = new Set(prev)
          season.episodes.forEach((e) => next.delete(episodeKey(season.season_number, e.episode_number)))
          return next
        })
      } catch (e: any) { alert(e.message) }
    } else {
      try {
        await markSeason(
          { show_id: show.id, show_name: show.name, show_poster_path: show.poster_path },
          season.season_number,
          season.episodes.map((e) => ({ number: e.episode_number, name: e.name })),
        )
        setWatchedKeys((prev) => {
          const next = new Set(prev)
          season.episodes.forEach((e) => next.add(episodeKey(season.season_number, e.episode_number)))
          return next
        })
      } catch (e: any) { alert(e.message) }
    }
  }

  if (err) return <div className="text-red-400">{err}</div>
  if (!show) return <div className="py-16 text-center text-[var(--color-text-dim)]">{t('common.loading')}</div>

  const seasonList = (show.seasons ?? []).filter((s) => s.season_number > 0 || (show.seasons?.length ?? 0) === 1)
  const year = show.first_air_date?.slice(0, 4) ?? ''
  const watchedCount = watchedKeys.size

  return (
    <div>
      {show.backdrop_path && (
        <div className="relative -mx-3 sm:-mx-0 sm:rounded-2xl overflow-hidden mb-5 sm:mb-6 aspect-[16/9] sm:aspect-[16/7] bg-[var(--color-surface)]">
          <img
            src={`https://image.tmdb.org/t/p/original${show.backdrop_path}`}
            alt=""
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/30 to-transparent" />
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/tv'))}
            aria-label={t('common.back')}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 h-9 px-3 inline-flex items-center text-sm bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur"
          >
            {t('common.back')}
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6 sm:mb-8">
        {poster(show.poster_path, 'w342') && (
          <img src={poster(show.poster_path, 'w342')!} alt="" className="w-32 sm:w-56 rounded-xl shadow-2xl shrink-0 mx-auto sm:mx-0" />
        )}
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight leading-tight break-words">{show.name}</h1>
            {show.original_name !== show.name && (
              <div className="text-sm text-[var(--color-text-dim)] mt-1">{show.original_name}</div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {year && <Pill>{year}</Pill>}
            {show.number_of_seasons != null && <Pill>{t('tv.seasonsLabel', { count: show.number_of_seasons })}</Pill>}
            {show.number_of_episodes != null && <Pill>{t('tv.episodesLabel', { count: show.number_of_episodes })}</Pill>}
            <Pill>★ TMDB {show.vote_average.toFixed(1)}</Pill>
            {user && watchedCount > 0 && (
              <Pill>{t('tv.watchedBadge', { count: watchedCount })}</Pill>
            )}
          </div>
          {show.genres && (
            <div className="flex flex-wrap gap-1.5">
              {show.genres.map((g) => <Pill key={g.id}>{g.name}</Pill>)}
            </div>
          )}
          {show.overview && <p className="text-sm leading-relaxed pt-2">{show.overview}</p>}

          {/* Show-level watched + watchlist toggles. Episode-level marking
              lives further down — this is the "I'm done with this whole
              show" / "add it to my queue" lane. */}
          {user && (() => {
            const k = mediaKey('tv', show.id)
            const isWatched = showWatchedKeys.has(k)
            const inWatchlist = showWatchlistKeys.has(k)
            const ref = { id: show.id, media_type: 'tv' as const, title: show.name, poster_path: show.poster_path }
            return (
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 pt-3">
                <button
                  onClick={() => toggleWatched(ref)}
                  className={`text-sm h-11 sm:h-auto sm:px-4 sm:py-2 px-3 rounded-lg transition active:scale-[0.98] ${
                    isWatched
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                      : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-border)]'
                  }`}
                >
                  {isWatched ? t('movie.watchedRemove') : t('card.markWatched')}
                </button>
                <button
                  onClick={() => toggleWatchlist(ref)}
                  className={`text-sm h-11 sm:h-auto sm:px-4 sm:py-2 px-3 rounded-lg transition active:scale-[0.98] ${
                    inWatchlist
                      ? 'bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/30'
                      : 'bg-transparent border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {inWatchlist ? t('movie.watchlistRemove') : t('movie.watchlistAdd')}
                </button>
              </div>
            )
          })()}
        </div>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] mb-3">{t('tv.seasons')}</h2>
        {!user && (
          <p className="text-sm text-[var(--color-text-dim)] mb-3">
            {t('tv.signInToTrack')}
          </p>
        )}
        <div className="space-y-2">
          {seasonList.map((s) => {
            const detail = seasons.get(s.season_number)
            const isOpen = openSeason === s.season_number
            const eps = detail?.episodes ?? []
            const allMarked = eps.length > 0 && eps.every((e) => watchedKeys.has(episodeKey(s.season_number, e.episode_number)))
            const markedInSeason = eps.filter((e) => watchedKeys.has(episodeKey(s.season_number, e.episode_number))).length

            return (
              <div key={s.season_number} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                <button
                  onClick={() => loadSeason(s.season_number)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)]/50 transition text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {poster(s.poster_path, 'w185') && (
                      <img src={poster(s.poster_path, 'w185')!} alt="" className="w-10 h-14 rounded object-cover shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="text-xs text-[var(--color-text-dim)]">
                        {t('tv.episodeCount', { count: s.episode_count })}
                        {detail && markedInSeason > 0 && ` · ${t('tv.watchedPartial', { watched: markedInSeason, total: eps.length })}`}
                        {s.air_date && ` · ${fmtDate(s.air_date)}`}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs text-[var(--color-text-dim)] transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {isOpen && detail && (
                  <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                    {user && eps.length > 0 && (
                      <div className="px-4 py-2 bg-[var(--color-surface-2)]/40 flex justify-end">
                        <button
                          onClick={() => toggleSeason(detail)}
                          className="text-xs px-3 py-1 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                        >
                          {allMarked ? t('tv.removeAllSeason') : t('tv.markAllSeason')}
                        </button>
                      </div>
                    )}
                    {eps.map((ep) => {
                      const k = episodeKey(s.season_number, ep.episode_number)
                      const watched = watchedKeys.has(k)
                      return (
                        <div key={ep.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)]/30">
                          <div className="text-xs text-[var(--color-text-dim)] tabular-nums w-10 shrink-0 pt-0.5">
                            S{s.season_number}E{ep.episode_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{ep.name}</div>
                            <div className="text-xs text-[var(--color-text-dim)] mt-0.5">
                              {ep.air_date && fmtDate(ep.air_date)}
                              {ep.runtime != null && ` · ${ep.runtime} min`}
                            </div>
                            {ep.overview && (
                              <div className="text-xs text-[var(--color-text-dim)] mt-1 line-clamp-2">{ep.overview}</div>
                            )}
                          </div>
                          <button
                            disabled={!user}
                            onClick={() => toggleEpisode(s.season_number, ep)}
                            className={`shrink-0 text-xs px-3 h-9 sm:h-auto sm:py-1 inline-flex items-center rounded-md transition active:scale-[0.96] ${
                              !user
                                ? 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)] cursor-not-allowed'
                                : watched
                                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                                : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] border border-transparent'
                            }`}
                            title={user ? '' : t('card.signInToMark')}
                          >
                            {watched ? t('tv.watchedToggleOn') : t('tv.watchedToggle')}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs">{children}</span>
}
