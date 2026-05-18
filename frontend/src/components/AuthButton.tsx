import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './Avatar'
import { displayName } from '../lib/auth'

/**
 * Header auth surface.
 * - Signed out → 'Sign in with Google' button.
 * - Signed in  → avatar chip that opens a small read-only identity card
 *                with a sign-out button at the bottom.
 *
 * The app uses Google as the source of truth for the user's identity;
 * there's no in-app profile editing.
 */
export function AuthButton() {
  const { t } = useTranslation()
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--color-surface-2)] transition"
      >
        <Avatar user={user} size="w-7 h-7" />
        <span className="text-xs text-[var(--color-text)] hidden sm:inline max-w-[140px] truncate">
          {displayName(user)}
        </span>
        <span className={`text-[10px] text-[var(--color-text-dim)] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-40 w-[260px] rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl">
          <div className="flex items-center gap-3 p-4">
            <Avatar user={user} size="w-12 h-12" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{displayName(user)}</div>
              <div className="text-[11px] text-[var(--color-text-dim)] truncate" title={user.email}>
                {user.email}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] p-2">
            <button
              onClick={() => { setOpen(false); signOut() }}
              className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-dim)] hover:text-red-400 transition"
            >
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
