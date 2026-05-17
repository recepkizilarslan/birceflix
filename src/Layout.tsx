import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AuthButton } from './components/AuthButton'
import { useAuth } from './hooks/useAuth'
import { getWatchedIdSet, listWatched, markWatched, unmarkWatched, type WatchedRow } from './lib/watched'

export interface LayoutContext {
  user: ReturnType<typeof useAuth>['user']
  watchedIds: Set<number>
  watchedRows: WatchedRow[]
  refreshWatched: () => Promise<void>
  toggleWatched: (m: { id: number; title: string; poster_path: string | null; imdb_id?: string | null }) => Promise<void>
}

export function Layout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set())
  const [watchedRows, setWatchedRows] = useState<WatchedRow[]>([])

  const refreshWatched = useCallback(async () => {
    if (!user) { setWatchedIds(new Set()); setWatchedRows([]); return }
    try {
      const rows = await listWatched()
      setWatchedRows(rows)
      setWatchedIds(new Set(rows.map((r) => r.tmdb_id)))
    } catch {
      setWatchedIds(await getWatchedIdSet())
    }
  }, [user])

  useEffect(() => { refreshWatched() }, [refreshWatched])

  const toggleWatched = useCallback(async (m: { id: number; title: string; poster_path: string | null; imdb_id?: string | null }) => {
    if (!user) { navigate('/'); return }
    try {
      if (watchedIds.has(m.id)) await unmarkWatched(m.id)
      else await markWatched(m)
      await refreshWatched()
    } catch (e: any) { alert(e.message) }
  }, [user, watchedIds, refreshWatched, navigate])

  const ctx: LayoutContext = { user, watchedIds, watchedRows, refreshWatched, toggleWatched }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 backdrop-blur bg-[var(--color-bg)]/85 border-b border-[var(--color-border)]">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="hover:opacity-90">
            <span
              className="block leading-none"
              style={{
                fontFamily: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
                color: '#E50914',
                fontSize: '1.875rem',
                letterSpacing: '0.01em',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              BIRCEFLIX
            </span>
          </Link>
          <nav className="flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1">
            <TabLink to="/">Keşfet</TabLink>
            <TabLink to="/watched">İzlediklerim {user && watchedIds.size > 0 ? `(${watchedIds.size})` : ''}</TabLink>
          </nav>
          <AuthButton />
        </div>
      </header>
      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-6">
        <Outlet context={ctx} />
      </main>
    </div>
  )
}

function TabLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }: { isActive: boolean }) =>
        `px-3 py-1.5 rounded-md text-sm transition ${isActive ? 'bg-[var(--color-accent)] text-black font-medium' : 'text-[var(--color-text-dim)] hover:text-white'}`
      }
    >
      {children}
    </NavLink>
  )
}
