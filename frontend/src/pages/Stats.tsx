import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LayoutContext } from '../Layout'
import { getStats, type Stats } from '../lib/stats'

export function StatsPage() {
  const { t } = useTranslation()
  const { user } = useOutletContext<LayoutContext>()
  const [stats, setStats] = useState<Stats | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setStats(null); setErr(null)
    getStats().then(setStats).catch((e) => setErr(e.message))
  }, [user])

  if (!user) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-8 text-center">
        <div className="text-lg mb-2">{t('stats.signInPrompt')}</div>
        <div className="text-sm text-[var(--color-text-dim)]">{t('auth.signInHint')}</div>
      </div>
    )
  }
  if (err) return <div className="text-red-400">{err}</div>
  if (!stats) return <div className="py-10 text-center text-[var(--color-text-dim)]">{t('common.loading')}</div>

  const ratingMax = Math.max(1, ...stats.rating_distribution)
  const monthMax = Math.max(1, ...stats.viewings_by_month.map((m) => m.count))
  const yearMaxViewings = Math.max(1, ...stats.viewings_by_year.map((y) => y.count))
  const yearMaxWatched = Math.max(1, ...stats.watched_by_year.map((y) => y.count))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('stats.title')}</h1>
        <p className="text-sm text-[var(--color-text-dim)] mt-1">
          {t('stats.subtitle')}
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t('stats.totalWatched')} value={stats.total_watched} />
        <StatCard label={t('stats.totalViewings')} value={stats.total_viewings} />
        <StatCard label={t('stats.totalRated')} value={stats.rating_distribution.reduce((a, b) => a + b, 0)} />
        <StatCard label={t('stats.distinctLocations')} value={stats.top_locations.length} />
      </div>

      <Section title={t('stats.ratingDistribution')}>
        {stats.rating_distribution.every((n) => n === 0) ? (
          <Empty>{t('stats.ratingEmpty')}</Empty>
        ) : (
          <div className="space-y-1.5">
            {stats.rating_distribution.map((n, i) => (
              <Bar key={i} label={`${i + 1}/10`} value={n} max={ratingMax} />
            ))}
          </div>
        )}
      </Section>

      <Section title={t('stats.lastTwelveMonths')}>
        {stats.viewings_by_month.length === 0 ? (
          <Empty>{t('stats.lastTwelveMonthsEmpty')}</Empty>
        ) : (
          <div className="space-y-1.5">
            {stats.viewings_by_month.map((m) => (
              <Bar key={m.month} label={m.month} value={m.count} max={monthMax} />
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title={t('stats.viewingsByYear')}>
          {stats.viewings_by_year.length === 0 ? (
            <Empty>{t('stats.viewingsByYearEmpty')}</Empty>
          ) : (
            <div className="space-y-1.5">
              {stats.viewings_by_year.map((y) => (
                <Bar key={y.year} label={String(y.year)} value={y.count} max={yearMaxViewings} />
              ))}
            </div>
          )}
        </Section>

        <Section title={t('stats.watchedByYear')}>
          {stats.watched_by_year.length === 0 ? (
            <Empty>{t('stats.watchedByYearEmpty')}</Empty>
          ) : (
            <div className="space-y-1.5">
              {stats.watched_by_year.map((y) => (
                <Bar key={y.year} label={String(y.year)} value={y.count} max={yearMaxWatched} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title={t('stats.topLocations')}>
        {stats.top_locations.length === 0 ? (
          <Empty>{t('stats.topLocationsEmpty')}</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.top_locations.map((l) => (
              <span key={l.location} className="px-2.5 py-1 rounded-full text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                📍 {l.location} · {l.count}
              </span>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-[var(--color-text-dim)] mt-1 leading-snug">{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
      <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-[var(--color-text-dim)]">{children}</div>
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-14 shrink-0 text-[var(--color-text-dim)] tabular-nums">{label}</div>
      <div className="flex-1 h-5 rounded bg-[var(--color-surface-2)] overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-10 text-right tabular-nums">{value}</div>
    </div>
  )
}
