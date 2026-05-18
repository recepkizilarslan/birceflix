import { useTranslation } from 'react-i18next'

/**
 * Download links for full JSON dump + Letterboxd-compatible CSV.
 *
 * The browser handles the actual download via Content-Disposition that
 * the backend sends, so we don't need fetch() / blob plumbing — plain
 * <a download> works.
 */
export function ExportSection() {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
        {t('exports.intro')}
      </p>

      <div className="flex flex-wrap gap-2">
        <a
          href="/api/export/json"
          className="text-sm px-4 py-2 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90"
        >
          {t('exports.jsonButton')}
        </a>
        <a
          href="/api/export/letterboxd-diary.csv"
          className="text-sm px-4 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
        >
          {t('exports.csvButton')}
        </a>
      </div>

      <p className="text-xs text-[var(--color-text-dim)] leading-relaxed">
        {t('exports.note')}
      </p>
    </div>
  )
}
