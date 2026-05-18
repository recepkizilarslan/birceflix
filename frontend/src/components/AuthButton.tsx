import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'

export function AuthButton() {
  const { t } = useTranslation()
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  if (loading) return <div className="text-xs text-[var(--color-text-dim)]">…</div>
  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-dim)] hidden sm:inline">{user.email}</span>
        <button
          onClick={() => signOut()}
          className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-border)]"
        >
          {t('auth.signOut')}
        </button>
      </div>
    )
  }
  return (
    <button
      onClick={() => signInWithGoogle()}
      className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90"
    >
      {t('auth.signIn')}
    </button>
  )
}
