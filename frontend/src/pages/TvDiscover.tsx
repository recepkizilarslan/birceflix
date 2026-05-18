import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchBar } from '../components/SearchBar'
import { poster } from '../lib/api'
import { popularTv, searchTv, type TmdbTvShow } from '../lib/tv'

export function TvDiscover() {
  const navigate = useNavigate()
  const [results, setResults] = useState<TmdbTvShow[]>([])
  const [query, setQuery] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const runPopular = useCallback(async (p = 1) => {
    setLoading(true); setErr(null); setQuery(null)
    try {
      const data = await popularTv(p)
      setResults(data.results)
      setPage(data.page)
      setTotalPages(Math.min(data.total_pages, 500))
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  const runSearch = useCallback(async (q: string, p = 1) => {
    setLoading(true); setErr(null); setQuery(q)
    try {
      const data = await searchTv(q, p)
      setResults(data.results)
      setPage(data.page)
      setTotalPages(Math.min(data.total_pages, 500))
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { runPopular(1) }, [runPopular])

  return (
    <div className="space-y-5">
      <SearchBar
        onSearch={(q) => runSearch(q, 1)}
        onClear={() => runPopular(1)}
      />

      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="text-[var(--color-text-dim)]">
          {query ? <>"{query}" için sonuçlar</> : 'Popüler diziler'}
        </div>
        {results.length > 0 && !loading && (
          <div className="text-xs text-[var(--color-text-dim)]">{results.length} sonuç · sayfa {page}</div>
        )}
      </div>

      {err && <div className="text-red-400 text-sm">{err}</div>}
      {loading && <div className="text-center text-[var(--color-text-dim)] py-10">Yükleniyor…</div>}
      {!loading && results.length === 0 && (
        <div className="text-center text-[var(--color-text-dim)] py-10">Sonuç bulunamadı.</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
        {results.map((s) => {
          const year = s.first_air_date?.slice(0, 4) ?? ''
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/tv/${s.id}`)}
              className="group rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition text-left"
            >
              <div className="aspect-[2/3] bg-[var(--color-surface-2)] overflow-hidden">
                {poster(s.poster_path) ? (
                  <img
                    src={poster(s.poster_path)!}
                    alt={s.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-dim)]">
                    Poster yok
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium leading-snug line-clamp-2">{s.name}</h3>
                  <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    ★ {s.vote_average.toFixed(1)}
                  </span>
                </div>
                <div className="text-xs text-[var(--color-text-dim)] mt-1">{year}</div>
              </div>
            </button>
          )
        })}
      </div>

      {results.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-6">
          <PageBtn disabled={page <= 1} onClick={() => {
            const p = page - 1
            if (query) runSearch(query, p)
            else runPopular(p)
          }}>← Önceki</PageBtn>
          <div className="text-sm text-[var(--color-text-dim)]">Sayfa {page} / {totalPages}</div>
          <PageBtn disabled={page >= totalPages} onClick={() => {
            const p = page + 1
            if (query) runSearch(query, p)
            else runPopular(p)
          }}>Sonraki →</PageBtn>
        </div>
      )}
    </div>
  )
}

function PageBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}
