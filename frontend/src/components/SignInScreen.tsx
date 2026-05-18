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

        <p className="mt-6 text-[11px] text-[var(--color-text-dim)]">
          {t('auth.signInHint')}
        </p>
      </div>

      {providers.length > 0 && <ProviderMarquee providers={providers} />}
    </div>
  )
}

/**
 * Infinite horizontal marquee of streaming-service logos. Pure CSS — the
 * row is duplicated so the second copy slides into view as the first
 * leaves, and the keyframe wraps at -50% for a seamless loop. Edges fade
 * to the background via a mask so logos appear/disappear smoothly.
 */
function ProviderMarquee({ providers }: { providers: ProviderListItem[] }) {
  const row = (
    <div className="flex shrink-0 items-center gap-6 px-3">
      {providers.map((p) => (
        <div
          key={p.provider_id}
          title={p.provider_name}
          className="h-12 w-12 rounded-xl bg-white/95 p-1.5 shadow-sm shrink-0 flex items-center justify-center"
        >
          <img
            src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
            alt={p.provider_name}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ))}
    </div>
  )

  return (
    <div
      className="w-full max-w-4xl overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
      }}
    >
      <div className="flex w-max animate-[marquee_28s_linear_infinite]">
        {row}
        {row}
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
