import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { patchMe } from '../lib/auth'
import { Avatar } from '../components/Avatar'

type Saving = 'idle' | 'saving' | 'saved' | 'error'

function isValidUrl(v: string): boolean {
  if (!v) return true // empty = clear
  try { new URL(v); return true } catch { return false }
}

export function ProfilePage() {
  const { t } = useTranslation()
  const { user, setUser } = useOutletContext<LayoutContext>()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState<Saving>('idle')
  const [err, setErr] = useState<string | null>(null)

  // Sync local form state when the user object loads / changes externally.
  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name ?? '')
    setLastName(user.last_name ?? '')
    setAvatarUrl(user.avatar_url ?? '')
  }, [user])

  if (!user) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
        <div className="text-lg mb-2">{t('profile.signInPrompt')}</div>
        <div className="text-sm text-[var(--color-text-dim)]">{t('auth.signInHint')}</div>
      </div>
    )
  }

  // Live preview uses the user object shape that Avatar expects.
  const previewUser = {
    first_name: firstName || null,
    last_name: lastName || null,
    name: [firstName, lastName].filter(Boolean).join(' ') || null,
    email: user.email,
    avatar_url: avatarUrl || null,
  }

  const submit = async (e: React.FormEvent) => {
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
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('profile.title')}</h1>
        <p className="text-sm text-[var(--color-text-dim)] mt-1 leading-relaxed">
          {t('profile.subtitle')}
        </p>
      </header>

      <form onSubmit={submit} className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-6 space-y-5">
        {/* Avatar preview + URL */}
        <div className="flex items-start gap-4">
          <div className="space-y-1.5 text-center shrink-0">
            <Avatar user={previewUser} size="w-20 h-20" />
            <div className="text-[10px] text-[var(--color-text-dim)]">{t('profile.preview')}</div>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-xs text-[var(--color-text-dim)] mb-1.5">
              {t('profile.avatarUrl')}
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder={t('profile.avatarUrlPlaceholder')}
              maxLength={1024}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
            <p className="text-[11px] text-[var(--color-text-dim)] mt-1.5 leading-snug">
              {t('profile.avatarHint')}
            </p>
          </div>
        </div>

        {/* Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-[var(--color-text-dim)] mb-1.5">{t('profile.firstName')}</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t('profile.firstNamePlaceholder')}
              maxLength={120}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[var(--color-text-dim)] mb-1.5">{t('profile.lastName')}</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t('profile.lastNamePlaceholder')}
              maxLength={120}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </label>
        </div>

        {/* Email (read-only) */}
        <div>
          <span className="block text-xs text-[var(--color-text-dim)] mb-1.5">{t('profile.emailLabel')}</span>
          <div className="bg-[var(--color-surface-2)]/50 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-dim)]">
            {user.email}
          </div>
          <p className="text-[11px] text-[var(--color-text-dim)] mt-1.5 leading-snug">{t('profile.emailHint')}</p>
        </div>

        {err && <div className="text-sm text-red-400">{err}</div>}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving === 'saving'}
            className="text-sm px-4 py-2 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving === 'saving' ? t('profile.saving') : t('profile.save')}
          </button>
          {saving === 'saved' && (
            <span className="text-xs text-emerald-400">{t('profile.saved')}</span>
          )}
        </div>
      </form>
    </div>
  )
}
