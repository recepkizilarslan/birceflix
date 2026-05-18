import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { importLetterboxdDiary, importLetterboxdWatched, type ImportReport } from '../lib/imports'
import { TraktImport } from '../components/TraktImport'
import { WebhookTokens } from '../components/WebhookTokens'
import { ExportSection } from '../components/ExportSection'

type Kind = 'watched' | 'diary'

export function ImportPage() {
  const { t } = useTranslation()
  const { user, refreshWatched } = useOutletContext<LayoutContext>()

  if (!user) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
        <div className="text-lg mb-2">{t('import.signInPrompt')}</div>
        <div className="text-sm text-[var(--color-text-dim)]">{t('auth.signInHint')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('import.title')}</h1>
        <p className="text-sm text-[var(--color-text-dim)] mt-1 leading-relaxed">
          {t('import.subtitle')}
        </p>
      </header>

      <ImportCard
        kind="watched"
        title="watched.csv"
        description={t('import.letterboxdWatchedDesc')}
        onComplete={refreshWatched}
      />
      <ImportCard
        kind="diary"
        title="diary.csv"
        description={t('import.letterboxdDiaryDesc')}
        onComplete={refreshWatched}
      />

      <section className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold">{t('trakt.sectionTitle')}</h3>
          <span className="text-xs text-[var(--color-text-dim)]">{t('trakt.sectionTag')}</span>
        </div>
        <p className="text-sm text-[var(--color-text-dim)] leading-relaxed mb-3">
          {t('trakt.sectionDesc')}
        </p>
        <TraktImport onComplete={refreshWatched} />
      </section>

      <section className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold">{t('webhooks.sectionTitle')}</h3>
          <span className="text-xs text-[var(--color-text-dim)]">{t('webhooks.sectionTag')}</span>
        </div>
        <WebhookTokens />
      </section>

      <section className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold">{t('exports.sectionTitle')}</h3>
          <span className="text-xs text-[var(--color-text-dim)]">{t('exports.sectionTag')}</span>
        </div>
        <ExportSection />
      </section>
    </div>
  )
}

function ImportCard({
  kind,
  title,
  description,
  onComplete,
}: {
  kind: Kind
  title: string
  description: string
  onComplete?: () => void
}) {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setBusy(true); setErr(null); setReport(null)
    try {
      const fn = kind === 'watched' ? importLetterboxdWatched : importLetterboxdDiary
      const r = await fn(file)
      setReport(r)
      onComplete?.()
    } catch (e: any) {
      setErr(e.message ?? t('import.uploadFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-[var(--color-text-dim)] leading-relaxed mb-3">{description}</p>

      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); setErr(null) }}
          className="text-sm text-[var(--color-text-dim)] file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[var(--color-surface-2)] file:text-[var(--color-text)] file:cursor-pointer"
        />
        <button
          type="submit"
          disabled={!file || busy}
          className="text-sm px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t('import.uploading') : t('import.upload')}
        </button>
      </form>

      {err && <div className="text-sm text-red-400 mt-3">{err}</div>}

      {report && (
        <div className="mt-4 space-y-2">
          <div className="text-sm">
            <Trans
              i18nKey="import.matched"
              values={{ matched: report.matched, total: report.total }}
              components={{ b: <span className="font-medium" /> }}
            />
            {report.unmatched.length > 0 && (
              <>
                {' '}
                <Trans
                  i18nKey="import.unmatched"
                  values={{ count: report.unmatched.length }}
                  components={{ b: <span className="font-medium text-red-400" /> }}
                />
              </>
            )}
          </div>
          {report.unmatched.length > 0 && (
            <details className="text-xs text-[var(--color-text-dim)]">
              <summary className="cursor-pointer hover:text-[var(--color-text)]">{t('import.unmatchedToggle')}</summary>
              <ul className="mt-2 max-h-64 overflow-y-auto space-y-1 pl-4 list-disc">
                {report.unmatched.map((u, i) => (
                  <li key={i}>
                    <span className="text-[var(--color-text)]">{u.name}</span>
                    {u.year ? ` (${u.year})` : ''} — {u.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
