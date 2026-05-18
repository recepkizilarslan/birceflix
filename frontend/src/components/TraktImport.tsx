import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  disconnectTrakt,
  getTraktStatus,
  importTraktHistory,
  startTraktConnect,
  type TraktImportResult,
  type TraktStatus,
} from '../lib/integrations'
import { intlLocale } from '../i18n'

interface Props {
  onComplete?: () => void
}

function fmt(dateIso: string | null): string | null {
  if (!dateIso) return null
  return new Date(dateIso).toLocaleString(intlLocale(), {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function TraktImport({ onComplete }: Props) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<TraktStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<TraktImportResult | null>(null)

  const refresh = async () => {
    try {
      setStatus(await getTraktStatus())
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => { refresh() }, [])

  const onImport = async () => {
    setBusy(true); setErr(null); setResult(null)
    try {
      const r = await importTraktHistory()
      setResult(r)
      onComplete?.()
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onDisconnect = async () => {
    if (!confirm(t('trakt.confirmDisconnect'))) return
    try {
      await disconnectTrakt()
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  if (!status) return <div className="text-sm text-[var(--color-text-dim)]">{t('trakt.statusLoading')}</div>

  if (!status.configured) {
    return (
      <div className="text-sm text-[var(--color-text-dim)] leading-relaxed">
        {t('trakt.notConfigured')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!status.connected ? (
        <>
          <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
            {t('trakt.connectIntro')}
          </p>
          <button
            onClick={startTraktConnect}
            className="text-sm px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90"
          >
            {t('trakt.connect')}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 text-xs">
              {t('trakt.connectedBadge')}
            </span>
            {status.last_sync_at && (
              <span className="text-xs text-[var(--color-text-dim)]">
                {t('trakt.lastSync', { when: fmt(status.last_sync_at) ?? '' })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onImport}
              disabled={busy}
              className="text-sm px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t('trakt.importing') : t('trakt.import')}
            </button>
            <button
              onClick={onDisconnect}
              disabled={busy}
              className="text-sm px-4 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
            >
              {t('trakt.disconnect')}
            </button>
          </div>
        </>
      )}

      {err && <div className="text-sm text-red-400">{err}</div>}
      {result && (
        <div className="text-sm">
          <Trans
            i18nKey="trakt.imported"
            values={{ count: result.imported }}
            components={{ b: <span className="font-medium" /> }}
          />
          {result.skipped_no_tmdb > 0 && (
            <>
              {' '}
              <Trans
                i18nKey="trakt.skipped"
                values={{ count: result.skipped_no_tmdb }}
                components={{ b: <span className="font-medium text-red-400" /> }}
              />
            </>
          )}
          {result.pages_read > 1 && (
            <span className="text-xs text-[var(--color-text-dim)]"> {t('trakt.pagesRead', { count: result.pages_read })}</span>
          )}
        </div>
      )}
    </div>
  )
}
