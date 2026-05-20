import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { movieDetail, poster, logo, getContentTitle, type MovieDetail } from '../lib/api'
import { mediaKey } from '../lib/watched'
import { useRegion } from '../lib/preferences'
import { PersonalNote } from '../components/PersonalNote'
import { AddToListMenu } from '../components/AddToListMenu'
import { WatchHistoryTimeline } from '../components/WatchHistoryTimeline'

export function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [region] = useRegion()
  const { user, watchedKeys, toggleWatched, watchlistKeys, toggleWatchlist } = useOutletContext<LayoutContext>()
  const [d, setD] = useState<MovieDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setD(null); setErr(null)
    movieDetail(Number(id), region).then(setD).catch((e) => setErr(e.message))
  }, [id, region, i18n.language])

  if (err) return <Wrap><div className="text-red-400">{err}</div></Wrap>
  if (!d) return <Wrap><div className="py-16 text-center text-[var(--color-text-dim)]">{t('common.loading')}</div></Wrap>

  const watched = watchedKeys.has(mediaKey('movie', d.id))
  const inWatchlist = watchlistKeys.has(mediaKey('movie', d.id))
  const year = d.release_date?.slice(0, 4) ?? ''
  const displayTitle = getContentTitle(d)

  return (
    <div>
      {d.backdrop_path && (
        <div className="relative -mx-3 sm:-mx-0 sm:rounded-2xl overflow-hidden mb-5 sm:mb-6 aspect-[16/9] sm:aspect-[16/7] bg-[var(--color-surface)]">
          <img
            src={`https://image.tmdb.org/t/p/original${d.backdrop_path}`}
            alt=""
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/30 to-transparent" />
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/discover'))}
            aria-label={t('common.back')}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 h-9 px-3 inline-flex items-center text-sm bg-black/60 hover:bg-black/80 rounded-lg backdrop-blur"
          >
            {t('common.back')}
          </button>
        </div>
      )}

      {!d.backdrop_path && (
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/discover'))}
          className="mb-4 text-sm text-[var(--color-text-dim)] hover:text-white"
        >
          {t('common.back')}
        </button>
      )}

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6 sm:mb-8">
        {poster(d.poster_path, 'w342') && (
          <img
            src={poster(d.poster_path, 'w342')!}
            alt=""
            className="w-32 sm:w-56 rounded-xl shadow-2xl shrink-0 mx-auto sm:mx-0"
          />
        )}
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight leading-tight break-words">{displayTitle}</h1>
            {d.original_title && d.original_title !== displayTitle && (
              <div className="text-sm text-[var(--color-text-dim)] mt-1">{d.original_title}</div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {year && <Pill>{year}</Pill>}
            {d.runtime ? <Pill>{Math.floor(d.runtime / 60)}s {d.runtime % 60}d</Pill> : null}
            <Pill>★ TMDB {d.vote_average.toFixed(1)}</Pill>
            {d.imdb_rating && <Pill>★ IMDB {d.imdb_rating}</Pill>}
          </div>
          {d.genres && (
            <div className="flex flex-wrap gap-1.5">
              {d.genres.map((g) => <Pill key={g.id}>{g.name}</Pill>)}
            </div>
          )}
          {d.imdb_id && (
            <div>
              <a href={`https://www.imdb.com/title/${d.imdb_id}`} target="_blank" rel="noreferrer" className="text-sm text-[var(--color-accent)] hover:underline">
                {t('movie.imdbPage')}
              </a>
            </div>
          )}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-2">
            <button
              disabled={!user}
              onClick={() => toggleWatched({ id: d.id, media_type: 'movie', title: displayTitle, poster_path: d.poster_path, imdb_id: d.imdb_id })}
              className={`h-11 sm:h-auto sm:px-5 sm:py-2.5 px-3 rounded-lg text-sm font-medium transition active:scale-[0.98] ${
                !user
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)] cursor-not-allowed'
                  : watched
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                  : 'bg-[var(--color-accent)] text-black hover:opacity-90'
              }`}
              title={user ? '' : t('card.signInToMark')}
            >
              {watched ? t('movie.watchedRemove') : t('card.markWatched')}
            </button>
            <button
              disabled={!user}
              onClick={() => toggleWatchlist({ id: d.id, media_type: 'movie', title: displayTitle, poster_path: d.poster_path, imdb_id: d.imdb_id })}
              className={`h-11 sm:h-auto sm:px-5 sm:py-2.5 px-3 rounded-lg text-sm font-medium transition border active:scale-[0.98] ${
                !user
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-text-dim)] border-[var(--color-border)] cursor-not-allowed'
                  : inWatchlist
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/25'
                  : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-accent)]'
              }`}
              title={user ? '' : t('movie.addToListSignInHint')}
            >
              {inWatchlist ? t('movie.watchlistRemove') : t('movie.watchlistAdd')}
            </button>
            {user && (
              <div className="col-span-2 sm:col-auto">
                <AddToListMenu tmdbId={d.id} title={displayTitle} posterPath={d.poster_path} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {d.overview && (
            <Section title={t('movie.summary')}>
              <p className="leading-relaxed">{d.overview}</p>
            </Section>
          )}

          {user && (
            <Section title={t('movie.history')}>
              <WatchHistoryTimeline tmdbId={d.id} />
            </Section>
          )}

          {d.credits?.cast && d.credits.cast.length > 0 && (
            <Section title={t('movie.cast')}>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {d.credits.cast.slice(0, 12).map((c) => (
                  <div key={c.id} className="w-24 shrink-0 text-center">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-[var(--color-surface-2)] mx-auto">
                      {c.profile_path && <img src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="text-sm mt-2 truncate">{c.name}</div>
                    <div className="text-xs text-[var(--color-text-dim)] truncate">{c.character}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {d.reviews?.results && d.reviews.results.length > 0 && (
            <Section title={t('movie.reviews', { count: d.reviews.results.length })}>
              <div className="space-y-3">
                {d.reviews.results.slice(0, 8).map((r) => (
                  <div key={r.id} className="bg-[var(--color-surface)] rounded-lg p-4 border border-[var(--color-border)]">
                    <div className="flex items-center justify-between text-xs text-[var(--color-text-dim)] mb-2">
                      <span className="font-medium text-[var(--color-text)]">{r.author}</span>
                      {r.author_details?.rating != null && <span>★ {r.author_details.rating}/10</span>}
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-6 whitespace-pre-line">{r.content}</p>
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-accent)] hover:underline mt-2 inline-block">
                      {t('movie.reviewFull')}
                    </a>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        <aside className="space-y-8">
          {user && (
            <Section title={t('movie.personalNote')}>
              <PersonalNote tmdbId={d.id} watched={watched} />
            </Section>
          )}

          {d.awards && (
            <Section title={t('movie.awards')}>
              <p className="text-sm leading-relaxed">{d.awards}</p>
              {d.imdb_id && (
                <a href={`https://www.imdb.com/title/${d.imdb_id}/awards`} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-accent)] hover:underline mt-2 inline-block">
                  {t('movie.awardsLink')}
                </a>
              )}
            </Section>
          )}

          <Section title={t('movie.watchProviders', { region })}>
            {!d.watch_providers && <div className="text-sm text-[var(--color-text-dim)]">{t('movie.noProviderForRegion')}</div>}
            {d.watch_providers && (
              <div className="space-y-4">
                <ProviderRow label={t('movie.providerSubscription')} items={d.watch_providers.flatrate} />
                <ProviderRow label={t('movie.providerRent')} items={d.watch_providers.rent} />
                <ProviderRow label={t('movie.providerBuy')} items={d.watch_providers.buy} />
                {d.watch_providers.link && (
                  <a href={d.watch_providers.link} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-accent)] hover:underline">{t('movie.justwatchLink')}</a>
                )}
              </div>
            )}
          </Section>

          {d.production_countries && d.production_countries.length > 0 && (
            <Section title={t('movie.production')}>
              <div className="text-sm space-y-1">
                <div><span className="text-[var(--color-text-dim)]">{t('movie.country')}:</span> {d.production_countries.map((c) => c.name).join(', ')}</div>
                {d.spoken_languages && d.spoken_languages.length > 0 && (
                  <div><span className="text-[var(--color-text-dim)]">{t('movie.spokenLanguages')}:</span> {d.spoken_languages.map((l) => l.english_name).join(', ')}</div>
                )}
              </div>
            </Section>
          )}
        </aside>
      </div>

      <div className="mt-12 text-center">
        <Link to="/discover" className="text-sm text-[var(--color-accent)] hover:underline">{t('movie.backToDiscover')}</Link>
      </div>
    </div>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs">{children}</span>
}

function ProviderRow({ label, items }: { label: string; items?: { provider_id: number; provider_name: string; logo_path: string }[] }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <div className="text-xs text-[var(--color-text-dim)] mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((p) => (
          <div key={p.provider_id} className="flex items-center gap-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg pl-1.5 pr-2.5 py-1">
            {logo(p.logo_path) && <img src={logo(p.logo_path)!} alt="" className="w-6 h-6 rounded" />}
            <span className="text-xs">{p.provider_name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
