import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listProviders, type ProviderListItem } from '../lib/api'
import { getRegion } from '../lib/preferences'
import { AuthError, loginWithPassword, registerWithPassword } from '../lib/auth'

/**
 * The unauthenticated landing screen. Mounted at `/login` and reached
 * either directly or via RequireAuth's redirect; the `next` query param
 * (set by RequireAuth) preserves the URL the user was originally trying
 * to reach so we can drop them back there once they sign in.
 *
 * The OAuth start endpoint (/api/auth/google) is a full-page navigation
 * away from the SPA, so it bypasses the SPA-level gate entirely.
 */
type Mode = 'login' | 'register'

/**
 * Reject anything that isn't a same-origin pathname. Without this an
 * attacker could craft /login?next=//evil.example/phish and turn the
 * post-login redirect into an open-redirect primitive.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/'
  try {
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin) return '/'
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}

export function SignInScreen() {
  const { t } = useTranslation()
  const { user, loading: authLoading, signInWithGoogle } = useAuth()
  const [searchParams] = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const [providers, setProviders] = useState<ProviderListItem[]>([])

  // If an already-authed user lands on /login (e.g. via bookmark or by
  // hitting "back" after signing in), bounce them straight to `next`.
  // We hard-navigate for parity with the post-submit path, which avoids
  // any drift between this redirect and the actual sign-in flow.
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = next
    }
  }, [authLoading, user, next])

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errCode, setErrCode] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrCode(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await loginWithPassword({ email, password })
      } else {
        await registerWithPassword({ email, password, name: name.trim() || undefined })
      }
      // Hard reload so every useAuth() instance re-probes /api/auth/me
      // and renders the authed app. `next` lands the user back where
      // they were originally trying to go.
      window.location.href = next
    } catch (e) {
      const code = e instanceof AuthError ? e.code : 'request_failed'
      setErrCode(code)
      setBusy(false)
    }
  }

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
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] pt-safe pl-safe pr-safe pb-safe">
      {/* Hero: logo + tagline. Tightens up on mobile. */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 sm:py-12">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <span
              className="block leading-none"
              style={{
                fontFamily: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
                color: '#E50914',
                fontSize: 'clamp(2.75rem, 11vw, 4rem)',
                letterSpacing: '0.02em',
                textShadow: '0 4px 8px rgba(0,0,0,0.5)',
              }}
            >
              BIRCEFLIX
            </span>
            <p className="mt-3 text-sm sm:text-base font-medium text-[var(--color-text)] leading-snug px-2">
              {t('auth.tagline')}
            </p>
          </div>

          {/* Mode tabs — Login | Register */}
          <div className="mt-7 flex p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setErrCode(null) }}
                className={`flex-1 h-10 rounded-lg text-sm font-medium transition ${
                  mode === m
                    ? 'bg-[var(--color-accent)] text-black'
                    : 'text-[var(--color-text-dim)] hover:text-white'
                }`}
              >
                {m === 'login' ? t('auth.login') : t('auth.register')}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-4 space-y-2.5 text-left">
            {mode === 'register' && (
              <input
                type="text"
                placeholder={t('auth.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                disabled={busy}
                className={inputCls}
              />
            )}
            <input
              type="email"
              required
              inputMode="email"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
              className={inputCls}
            />
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                minLength={mode === 'register' ? 10 : 1}
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={busy}
                className={`${inputCls} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-lg text-[var(--color-text-dim)] hover:text-white hover:bg-[var(--color-surface-2)]"
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {mode === 'register' && password.length > 0 && !isStrongEnough(password) && (
              <div className="text-[11px] text-[var(--color-text-dim)] pt-0.5">
                {t('auth.errors.weak_password')}
              </div>
            )}

            {errCode && (
              <div className="text-xs text-red-400 text-center pt-1">
                {t(`auth.errors.${errCode}`, { defaultValue: t('auth.errors.request_failed') })}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="w-full inline-flex items-center justify-center gap-2 px-5 h-12 rounded-xl bg-[var(--color-accent)] text-black font-semibold text-[15px] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.99]"
            >
              {busy ? t('common.loading') : (mode === 'login' ? t('auth.login') : t('auth.register'))}
            </button>
          </form>

          {/* "veya" divider */}
          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span>{t('auth.or')}</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          <button
            onClick={() => signInWithGoogle(next)}
            className="w-full inline-flex items-center justify-center gap-2.5 px-5 h-12 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-text-dim)] text-[var(--color-text)] font-medium text-[15px] transition active:scale-[0.99]"
          >
            <GoogleIcon />
            {mode === 'login' ? t('auth.signInWithGoogle') : t('auth.signUpWithGoogle')}
          </button>

          <p className="mt-5 text-[11px] text-center text-[var(--color-text-dim)] leading-relaxed px-2">
            {t('auth.legalHint', {
              defaultValue: 'Devam ederek hizmet şartlarımızı kabul etmiş sayılırsın.',
            })}
          </p>
        </div>
      </div>

      {/* Brand marquee — anchored to bottom of viewport so the form area
          stays vertically centered above it on tall screens. */}
      <section className="w-full max-w-5xl mx-auto pb-2">
        <BrandMarquee providers={providers} />
      </section>
    </div>
  )
}

/**
 * Single combined marquee of every brand the app speaks to — TMDB watch
 * providers (Netflix, Disney+, ...) and our data/scrobble integrations
 * (IMDb, Trakt, Letterboxd, Plex, Jellyfin, ...) all share one strip.
 * Visually consistent: every brand is a fixed-width column with a tile
 * on top and the brand name below. Tile size shrinks on mobile.
 */
function BrandMarquee({ providers }: { providers: ProviderListItem[] }) {
  const tiles: { key: string; node: React.ReactNode; name: string }[] = [
    ...providers.map((p) => ({
      key: `p-${p.provider_id}`,
      name: p.provider_name,
      node: (
        <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl bg-white/95 p-1.5 sm:p-2 shadow-md flex items-center justify-center">
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

  if (tiles.length === 0) return null

  const duration = Math.max(28, Math.min(50, Math.round(tiles.length * 1.6)))

  return (
    <Marquee duration={duration}>
      <div className="flex shrink-0 items-start gap-5 sm:gap-7 px-3.5">
        {tiles.map((t) => (
          <div key={t.key} className="flex flex-col items-center gap-1.5 sm:gap-2 shrink-0 w-16 sm:w-20">
            {t.node}
            <span className="text-[9.5px] sm:text-[10.5px] text-[var(--color-text-dim)] text-center leading-tight line-clamp-2">
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
 * colors so the row reads at a glance even at small sizes.
 */
function integrationBrands(): { key: string; name: string; node: React.ReactNode }[] {
  const tile = 'h-12 w-12 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md'
  return [
    {
      key: 'i-tmdb',
      name: 'TMDB',
      node: (
        <div className={tile} style={{ background: 'linear-gradient(90deg, #90cea1 0%, #01b4e4 100%)' }}>
          <span className="font-black text-[11px] sm:text-[15px] tracking-tight" style={{ color: '#0d253f' }}>TMDB</span>
        </div>
      ),
    },
    {
      key: 'i-imdb',
      name: 'IMDb',
      node: (
        <div className={tile} style={{ background: '#F5C518' }}>
          <span className="font-black italic text-[13px] sm:text-[17px] text-black tracking-tight">IMDb</span>
        </div>
      ),
    },
    {
      key: 'i-trakt',
      name: 'Trakt',
      node: (
        <div className={`${tile} bg-black border border-[#ED1C24]/40`}>
          <span className="font-bold text-[11px] sm:text-[14px]" style={{ color: '#ED1C24' }}>trakt</span>
        </div>
      ),
    },
    {
      key: 'i-letterboxd',
      name: 'Letterboxd',
      node: (
        <div className={`${tile} gap-1 bg-[#202830]`}>
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#FF8000' }} />
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#00E054' }} />
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#40BCF4' }} />
        </div>
      ),
    },
    {
      key: 'i-plex',
      name: 'Plex',
      node: (
        <div className={`${tile} bg-black`}>
          <span className="font-black text-[11px] sm:text-[14px] tracking-tight" style={{ color: '#E5A00D' }}>PLEX</span>
        </div>
      ),
    },
    {
      key: 'i-jellyfin',
      name: 'Jellyfin',
      node: (
        <div className={tile} style={{ background: 'linear-gradient(135deg, #AA5CC3 0%, #00A4DC 100%)' }}>
          <span className="font-bold text-[9px] sm:text-[11px] text-white tracking-wide">Jellyfin</span>
        </div>
      ),
    },
  ]
}

// 12px on mobile to avoid iOS zoom is handled in index.css; padding gives
// the larger touch height (~44px) that mobile platforms expect.
const inputCls = 'w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 h-12 text-[var(--color-text)] placeholder-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-text-dim)] disabled:opacity-60'

/**
 * Client-side mirror of backend/src/auth/passwordPolicy.ts — kept simple
 * so the strength hint can update on every keystroke. The server is the
 * source of truth; this is only for instant UX feedback.
 */
function isStrongEnough(pw: string): boolean {
  if (pw.length < 10) return false
  const classes =
    (/[a-z0-9]/.test(pw) ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/[0-9]/.test(pw) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pw) ? 1 : 0)
  return classes >= 3
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

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
