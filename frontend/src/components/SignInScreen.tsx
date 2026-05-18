import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--color-bg)]">
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
        <p className="mt-4 text-sm text-[var(--color-text-dim)]">
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
