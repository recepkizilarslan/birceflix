import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './Avatar'
import { displayName, patchMe } from '../lib/auth'

type Saving = 'idle' | 'saving' | 'saved' | 'error'

function isValidUrl(v: string): boolean {
  if (!v) return true
  try { new URL(v); return true } catch { return false }
}

/**
 * Header auth surface.
 * - Signed out → 'Sign in with Google' button.
 * - Signed in  → avatar chip that opens a dropdown with the editable
 *                profile form + sign out.
 */
export function AuthButton() {
  const { t } = useTranslation()
  const { user, loading, signInWithGoogle, signOut, setUser } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState<Saving>('idle')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name ?? '')
    setLastName(user.last_name ?? '')
    setAvatarUrl(user.avatar_url ?? '')
  }, [user])

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

  const previewUser = {
    first_name: firstName || null,
    last_name: lastName || null,
    name: [firstName, lastName].filter(Boolean).join(' ') || null,
    email: user.email,
    avatar_url: avatarUrl || null,
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (avatarUrl && !isValidUrl(avatarUrl)) {
      setErr(t('profile.invalidUrl'))
      return
    }
    setSaving('saving')
    try {
      const updated = await patchMe({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      setUser(updated)
      setSaving('saved')
      window.setTimeout(() => setSaving((s) => (s === 'saved' ? 'idle' : s)), 2000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('profile.saveFailed'))
      setSaving('error')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('profile.title')}
        aria-expanded={open}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--color-surface-2)] transition"
      >
        <Avatar user={user} size="w-7 h-7" />
        <span className="text-xs text-[var(--color-text)] hidden sm:inline max-w-[120px] truncate">
          {displayName(user)}
        </span>
        <span className={`text-[10px] text-[var(--color-text-dim)] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-40 w-[320px] rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl">
          <form onSubmit={onSave} className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar user={previewUser} size="w-12 h-12" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{displayName(previewUser)}</div>
                <div className="text-[11px] text-[var(--color-text-dim)] truncate" title={user.email}>{user.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[10px] text-[var(--color-text-dim)] mb-1">{t('profile.firstName')}</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t('profile.firstNamePlaceholder')}
                  maxLength={120}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[var(--color-accent)]"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] text-[var(--color-text-dim)] mb-1">{t('profile.lastName')}</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t('profile.lastNamePlaceholder')}
                  maxLength={120}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[var(--color-accent)]"
                />
              </label>
            </div>

            <label className="block">
              <span className="block text-[10px] text-[var(--color-text-dim)] mb-1">{t('profile.avatarUrl')}</span>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder={t('profile.avatarUrlPlaceholder')}
                maxLength={1024}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[var(--color-accent)]"
              />
            </label>

            {err && <div className="text-[11px] text-red-400">{err}</div>}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saving === 'saving'}
                className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving === 'saving' ? t('profile.saving') : t('profile.save')}
              </button>
              {saving === 'saved' && (
                <span className="text-[11px] text-emerald-400">{t('profile.saved')}</span>
              )}
            </div>
          </form>

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
