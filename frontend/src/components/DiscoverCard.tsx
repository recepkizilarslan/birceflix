import { useTranslation } from 'react-i18next'
import { logo, poster } from '../lib/api'
import type { MediaType } from '../lib/watched'

/** Minimal shape used by the optional corner banner. We don't reuse the
 * full WatchProvider type from api.ts so callers can hand in any source
 * (TMDB list snapshot, /movie detail, etc.) without contortions. */
export interface ProviderBadge {
  provider_id: number
  provider_name: string
  logo_path: string
}

/**
 * Card item shape — accepts either a TmdbMovie or TmdbTvShow normalised to
 * a small common surface. We don't take the union of those interfaces here
 * because the parent already knows which media type it's rendering.
 */
export interface DiscoverCardItem {
  id: number
  media_type: MediaType
  /** Movie's `title` or TV's `name`. */
  title: string
  poster_path: string | null
  /** TMDB ★ rating (0-10). */
  vote_average: number
  /** Movie's `release_date` or TV's `first_air_date` — only the year is shown. */
  date: string | null
  /** Optional secondary line — e.g. "2 sezon · 16 bölüm" on TV. */
  meta?: React.ReactNode
}

interface Props {
  item: DiscoverCardItem
  onOpen: (item: DiscoverCardItem) => void
  /** Watched toggle. Hidden when null (e.g. for the unauthed shell, though
   *  we now gate the whole app). */
  onToggleWatched: ((item: DiscoverCardItem) => void) | null
  watched: boolean
  /** Watchlist toggle. Hidden when null. */
  onToggleWatchlist: ((item: DiscoverCardItem) => void) | null
  inWatchlist: boolean
  /** When set, shown as a corner badge — used on the Watched page. */
  myRating?: number | null
  /** Optional streaming providers shown as a bottom-left banner. Up to
   * three logos are rendered; an empty array renders nothing (treated as
   * "no flatrate platform" which the consumer may or may not want to
   * surface). */
  providerBanner?: ProviderBadge[]
  /** When false, suppresses the "watched" dim/watermark overlay even if
   *  `watched` is true. The Watched page passes this so its grid (where
   *  every card is watched by definition) doesn't drown in overlays. */
  showWatchedOverlay?: boolean
}

/**
 * One card on the discover grid. Generic over movie vs TV so a single
 * component renders both with identical action affordances (watched +
 * watchlist toggles). Visual baseline is the original MovieCard.
 */
export function DiscoverCard({
  item,
  onOpen,
  onToggleWatched,
  watched,
  onToggleWatchlist,
  inWatchlist,
  myRating,
  providerBanner,
  showWatchedOverlay = true,
}: Props) {
  const { t } = useTranslation()
  const year = item.date?.slice(0, 4) ?? ''
  const overlay = watched && showWatchedOverlay

  return (
    <div className="group rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition flex flex-col">
      {/* Card body acts like a link, but contains nested controls (heart),
          so it's a div with role=button instead of a real <button>. */}
      <div
        onClick={() => onOpen(item)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(item) } }}
        role="button"
        tabIndex={0}
        className="block w-full text-left cursor-pointer"
      >
        <div className="relative aspect-[2/3] bg-[var(--color-surface-2)] overflow-hidden">
          {poster(item.poster_path) ? (
            <img
              src={poster(item.poster_path)!}
              alt={item.title}
              loading="lazy"
              className={`w-full h-full object-cover group-hover:scale-105 transition duration-300 ${overlay ? 'grayscale-[40%]' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-dim)]">
              {t('card.noPoster')}
            </div>
          )}
          {overlay && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-black/55" aria-hidden />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="-rotate-12 px-3 py-1 rounded-md border-2 border-emerald-300/80 text-emerald-200 text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.18em] bg-black/35 backdrop-blur-sm shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
                  {t('card.watchedWatermark')}
                </div>
              </div>
            </>
          )}
          {/* TMDB rating chip — corner badge stays readable over any poster. */}
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/65 backdrop-blur text-white text-[10px] sm:text-[11px] font-semibold tabular-nums">
            ★ {item.vote_average.toFixed(1)}
          </div>
          {myRating != null && (
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[var(--color-accent)] text-black text-[10px] sm:text-[11px] font-semibold shadow">
              ★ {myRating}
            </div>
          )}
          {/* Streaming-provider banner: up to 3 logos stacked at the
              bottom-left of the poster. Bottom-right stays free for the
              watchlist heart. */}
          {providerBanner && providerBanner.length > 0 && (
            <div
              className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-1 rounded-md bg-black/65 backdrop-blur"
              aria-label={providerBanner.map((p) => p.provider_name).join(', ')}
            >
              {providerBanner.slice(0, 3).map((p) => (
                <img
                  key={p.provider_id}
                  src={logo(p.logo_path, 'w45') ?? ''}
                  alt={p.provider_name}
                  title={p.provider_name}
                  loading="lazy"
                  className="h-5 w-5 rounded-sm object-cover"
                />
              ))}
              {providerBanner.length > 3 && (
                <span className="text-[10px] font-semibold text-white/85 tabular-nums pl-0.5">
                  +{providerBanner.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Watchlist quick-add: heart icon, sits over the poster bottom-left
              like an e-commerce favorite. Hidden on hover-less mobile? No —
              the goal is one-tap save without opening the detail page. */}
          {onToggleWatchlist && (
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleWatchlist(item) }}
              aria-label={inWatchlist ? t('card.inWatchlist') : t('card.addToWatchlist')}
              className={`absolute bottom-1.5 right-1.5 h-9 w-9 inline-flex items-center justify-center rounded-full backdrop-blur shadow active:scale-90 transition ${
                inWatchlist
                  ? 'bg-[var(--color-accent)] text-black'
                  : 'bg-black/55 text-white hover:bg-black/75'
              }`}
            >
              <HeartIcon filled={inWatchlist} />
            </button>
          )}
        </div>
        <div className="p-2.5 sm:p-3">
          <h3 className="text-[13px] sm:text-sm font-medium leading-snug line-clamp-2 min-h-[2.4em]">{item.title}</h3>
          <div className="text-[11px] sm:text-xs text-[var(--color-text-dim)] mt-1 flex flex-wrap items-center gap-x-1.5">
            {year && <span>{year}</span>}
            {item.meta && <>{year && <span>·</span>}<span>{item.meta}</span></>}
          </div>
        </div>
      </div>

      {onToggleWatched && (
        <div className="mt-auto px-2.5 sm:px-3 pb-2.5 sm:pb-3">
          <button
            onClick={() => onToggleWatched(item)}
            className={`w-full text-[13px] sm:text-sm h-9 sm:h-auto sm:py-1.5 rounded-lg transition active:scale-[0.98] ${
              watched
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-border)]'
            }`}
          >
            {watched ? t('card.watched') : t('card.markWatched')}
          </button>
        </div>
      )}
    </div>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}
