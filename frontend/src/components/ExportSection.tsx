/**
 * Download links for full JSON dump + Letterboxd-compatible CSV.
 *
 * The browser handles the actual download via Content-Disposition that
 * the backend sends, so we don't need fetch() / blob plumbing — plain
 * <a download> works.
 */
export function ExportSection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
        Verini istediğin zaman indir. JSON dump tüm kayıtlarını içerir
        (izlenenler, geçmiş, watchlist, izleme listeleri, dizi bölümleri, kişisel listeler).
        Letterboxd CSV'si ile başka bir platforma taşıyabilirsin.
      </p>

      <div className="flex flex-wrap gap-2">
        <a
          href="/api/export/json"
          className="text-sm px-4 py-2 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90"
        >
          Tam JSON dump indir
        </a>
        <a
          href="/api/export/letterboxd-diary.csv"
          className="text-sm px-4 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
        >
          Letterboxd CSV indir
        </a>
      </div>

      <p className="text-xs text-[var(--color-text-dim)] leading-relaxed">
        JSON dump'ı güvenlik gerekçesiyle hiçbir secret (Trakt token, webhook
        token) içermez — yedek olmasından çok "verim bende" amaçlıdır.
        Letterboxd CSV'si tarih / başlık / puan içerir; yıl bilgisi
        depolanmadığı için boş kalır, Letterboxd başlığa göre eşleştirir.
      </p>
    </div>
  )
}
