import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (input: { name: string; description: string | null }) => Promise<void>
}

/**
 * Centered modal for naming + describing a filter snapshot before saving.
 * Closes on Esc, backdrop click, or Cancel. Auto-focuses the name input
 * when opened.
 */
export function SaveFilterDialog({ open, onClose, onSave }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setErr(null)
      setBusy(false)
      // Defer focus until after the dialog has mounted/painted.
      setTimeout(() => nameRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && !busy

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setBusy(true)
    setErr(null)
    try {
      await onSave({
        name: trimmed,
        description: description.trim() ? description.trim() : null,
      })
      onClose()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2))
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={submit} className="p-5 space-y-4">
          <h2 className="text-base font-semibold">{t('savedFilters.dialogTitle')}</h2>

          <div className="space-y-1.5">
            <label className="text-xs text-[var(--color-text-dim)]">
              {t('savedFilters.nameLabel')}
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder={t('savedFilters.namePlaceholder')}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[var(--color-text-dim)]">
              {t('savedFilters.descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t('savedFilters.descriptionPlaceholder')}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)] resize-none"
            />
          </div>

          {err && <div className="text-sm text-red-400">{err}</div>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
