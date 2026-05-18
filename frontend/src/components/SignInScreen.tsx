import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { listProviders, type ProviderListItem } from '../lib/api'
import { getRegion } from '../lib/preferences'

/**
 * The unauthenticated landing screen. Layout renders this in place of the
 * normal app shell when there's no session — i.e. nobody can navigate to
 * any page without signing in first.
 *
 * The OAuth start endpoint (/api/auth/google) is a full-page navigation
 * away from the SPA, so the gate above doesn't need to do anything
 * special to allow it.
 */
export function SignInScreen() {
  const { t } = useTranslation()
  const { signInWithGoogle } = useAuth()
  const [providers, setProviders] = useState<ProviderListItem[]>([])

  useEffect(() => {
    // Best-effort — if the request fails (offline, gate misconfigured)
    // we just hide the marquee. The sign-in flow itself doesn't depend
    // on it.
    listProviders(getRegion())
      .then((rows) => {
        // Top-20 by TMDB display priority — gives us the recognisable
        // services (Netflix/Disney+/Prime/HBO etc.) and avoids the
        // long tail of niche channels.
        const top = [...rows]
          .sort((a, b) => a.display_priority - b.display_priority)
          .slice(0, 20)
        setProviders(top)
      })
      .catch(() => setProviders([]))
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[var(--color-bg)] gap-12">
      <div className="text-center max-w-sm w-full">
        <span
          className="block leading-none"
          style={{
            fontFamily: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
            color: '#E50914',
            fontSize: '4rem',
            letterSpacing: '0.02em',
            textShadow: '0 4px 8px rgba(0,0,0,0.5)',
          }}
        >
          BIRCEFLIX
        </span>

        {/* Tagline — single line, sells what the app is in 6-8 words. */}
        <p className="mt-3 text-base sm:text-lg font-medium text-[var(--color-text)] leading-snug">
          {t('auth.tagline')}
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-dim)]">
          {t('auth.signInToContinue')}
        </p>

        <button
          onClick={() => signInWithGoogle()}
          className="mt-8 w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90 transition"
        >
          <GoogleIcon />
          {t('auth.signIn')}
        </button>
      </div>

      <section className="w-full max-w-5xl">
        <BrandMarquee providers={providers} />
      </section>
    </div>
  )
}

/**
 * Single combined marquee of every brand the app speaks to — TMDB watch
 * providers (Netflix, Disney+, ...) and our data/scrobble integrations
 * (IMDb, Trakt, Letterboxd, Plex, Jellyfin, ...) all share one strip.
 * Visually consistent: every brand is a w-20 column with a tile on top
 * and the brand name below.
 */
function BrandMarquee({ providers }: { providers: ProviderListItem[] }) {
  const tiles: { key: string; node: React.ReactNode; name: string }[] = [
    ...providers.map((p) => ({
      key: `p-${p.provider_id}`,
      name: p.provider_name,
      node: (
        <div className="h-16 w-16 rounded-2xl bg-white/95 p-2 shadow-md flex items-center justify-center">
          <img
            src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
            alt={p.provider_name}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ),
    })),
    ...integrationBrands(),
  ]

  // No tiles at all? Skip — the provider fetch failed and there'd be only
  // integration chips, which feels orphaned without context.
  if (tiles.length === 0) return null

  // Slow the scroll if we have a lot to show — keeps long names readable.
  const duration = Math.max(28, Math.min(50, Math.round(tiles.length * 1.6)))

  return (
    <Marquee duration={duration}>
      <div className="flex shrink-0 items-start gap-7 px-3.5">
        {tiles.map((t) => (
          <div key={t.key} className="flex flex-col items-center gap-2 shrink-0 w-20">
            {t.node}
            <span className="text-[10.5px] text-[var(--color-text-dim)] text-center leading-tight line-clamp-2">
              {t.name}
            </span>
          </div>
        ))}
      </div>
    </Marquee>
  )
}

/**
 * Shared marquee scaffolding — the children prop is treated as one "row",
 * and the row is rendered twice with a `translateX(-50%)` keyframe so the
 * loop is seamless. Pauses while the user is hovering over the strip.
 */
function Marquee({ children, duration = 28 }: { children: React.ReactNode; duration?: number }) {
  return (
    <div
      className="w-full overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
      }}
    >
      <div
        className="flex w-max hover:[animation-play-state:paused]"
        style={{ animation: `marquee ${duration}s linear infinite` }}
      >
        {children}
        {children}
      </div>
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

/**
 * Brand chips for the data/scrobble integrations the app speaks to.
 * Pure CSS — each chip mimics the brand's wordmark/logo in its native
 * colors so the row reads at a glance even at small sizes. No external
 * asset loading. The chip is fixed at h-16 w-16 to line up with the
 * provider tiles in the combined marquee above.
 */
function integrationBrands(): { key: string; name: string; node: React.ReactNode }[] {
  return [
    {
      key: 'i-tmdb',
      name: 'TMDB',
      node: (
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(90deg, #90cea1 0%, #01b4e4 100%)' }}>
          <span className="font-black text-[15px] tracking-tight" style={{ color: '#0d253f' }}>TMDB</span>
        </div>
      ),
    },
    {
      key: 'i-imdb',
      name: 'IMDb',
      node: (
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md" style={{ background: '#F5C518' }}>
          <span className="font-black italic text-[17px] text-black tracking-tight">IMDb</span>
        </div>
      ),
    },
    {
      key: 'i-trakt',
      name: 'Trakt',
      node: (
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md bg-black border border-[#ED1C24]/40">
          <span className="font-bold text-[14px]" style={{ color: '#ED1C24' }}>trakt</span>
        </div>
      ),
    },
    {
      key: 'i-letterboxd',
      name: 'Letterboxd',
      node: (
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center gap-1 shadow-md bg-[#202830]">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FF8000' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#00E054' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#40BCF4' }} />
        </div>
      ),
    },
    {
      key: 'i-plex',
      name: 'Plex',
      node: (
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md bg-black">
          <span className="font-black text-[14px] tracking-tight" style={{ color: '#E5A00D' }}>PLEX</span>
        </div>
      ),
    },
    {
      key: 'i-jellyfin',
      name: 'Jellyfin',
      node: (
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg, #AA5CC3 0%, #00A4DC 100%)' }}>
          <span className="font-bold text-[11px] text-white tracking-wide">Jellyfin</span>
        </div>
      ),
    },
  ]
}

/** Inline Google "G" logo so we don't pull in another asset. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
