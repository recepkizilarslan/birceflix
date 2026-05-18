import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './Avatar'
import { displayName } from '../lib/auth'

/**
 * Returns auth-related header items flat (as a React Fragment) so the
 * parent header's flex/gap layout applies directly — no nested wrapper.
 */
export function AuthButton() {
  const { t } = useTranslation()
  const { user, loading, signInWithGoogle, signOut } = useAuth()

  if (loading) {
    return <span className="text-xs text-[var(--color-text-dim)]">…</span>
  }

  if (!user) {
    return (
      <button
        onClick={() => signInWithGoogle()}
        className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90"
      >
        {t('auth.signIn')}
      </button>
    )
  }

  return (
    <>
      <Link
        to="/profile"
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--color-surface-2)] transition"
        title={t('profile.title')}
      >
        <Avatar user={user} size="w-7 h-7" />
        <span className="text-xs text-[var(--color-text)] hidden sm:inline max-w-[120px] truncate">
          {displayName(user)}
        </span>
      </Link>
      <button
        onClick={() => signOut()}
        className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-border)]"
      >
        {t('auth.signOut')}
      </button>
    </>
  )
}
