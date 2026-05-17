import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { LayoutContext } from '../Layout'
import { getStats, type Stats } from '../lib/stats'

export function StatsPage() {
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
        <div className="text-lg mb-2">İstatistiklerini görmek için giriş yap</div>
        <div className="text-sm text-[var(--color-text-dim)]">Sağ üstten Google ile giriş yapabilirsin.</div>
      </div>
    )
  }
  if (err) return <div className="text-red-400">{err}</div>
  if (!stats) return <div className="py-10 text-center text-[var(--color-text-dim)]">Yükleniyor…</div>

  const ratingMax = Math.max(1, ...stats.rating_distribution)
  const monthMax = Math.max(1, ...stats.viewings_by_month.map((m) => m.count))
  const yearMaxViewings = Math.max(1, ...stats.viewings_by_year.map((y) => y.count))
  const yearMaxWatched = Math.max(1, ...stats.watched_by_year.map((y) => y.count))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">İstatistikler</h1>
        <p className="text-sm text-[var(--color-text-dim)] mt-1">
          Daha zengin ölçütler (tür, süre, oyuncu) ileride filmin meta verileri kaydedildikçe gelecek.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Toplam izlenen film" value={stats.total_watched} />
        <StatCard label="İzleme kaydı (rewatch dahil)" value={stats.total_viewings} />
        <StatCard label="Puanlama yaptığın film" value={stats.rating_distribution.reduce((a, b) => a + b, 0)} />
        <StatCard label="Farklı yer" value={stats.top_locations.length} />
      </div>

      <Section title="Puan dağılımı">
        {stats.rating_distribution.every((n) => n === 0) ? (
          <Empty>Henüz puan vermedin.</Empty>
        ) : (
          <div className="space-y-1.5">
            {stats.rating_distribution.map((n, i) => (
              <Bar key={i} label={`${i + 1}/10`} value={n} max={ratingMax} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Son 12 ay">
        {stats.viewings_by_month.length === 0 ? (
          <Empty>Son 12 ayda kayıtlı izleme yok.</Empty>
        ) : (
          <div className="space-y-1.5">
            {stats.viewings_by_month.map((m) => (
              <Bar key={m.month} label={m.month} value={m.count} max={monthMax} />
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Yıla göre izleme (history)">
          {stats.viewings_by_year.length === 0 ? (
            <Empty>İzleme geçmişi yok.</Empty>
          ) : (
            <div className="space-y-1.5">
              {stats.viewings_by_year.map((y) => (
                <Bar key={y.year} label={String(y.year)} value={y.count} max={yearMaxViewings} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Yıla göre 'izledim' işareti">
          {stats.watched_by_year.length === 0 ? (
            <Empty>Henüz işaretli film yok.</Empty>
          ) : (
            <div className="space-y-1.5">
              {stats.watched_by_year.map((y) => (
                <Bar key={y.year} label={String(y.year)} value={y.count} max={yearMaxWatched} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="En çok izlediğin yerler">
        {stats.top_locations.length === 0 ? (
          <Empty>İzleme geçmişinde lokasyon belirtmemişsin.</Empty>
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
