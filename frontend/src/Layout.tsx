import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthButton } from './components/AuthButton'
import { PreferencesMenu } from './components/PreferencesMenu'
import { useAuth } from './hooks/useAuth'
import { getWatchedIdSet, listWatched, markWatched, unmarkWatched, type WatchedRow } from './lib/watched'
import { addToWatchlist, listWatchlist, removeFromWatchlist, type WatchlistRow } from './lib/watchlist'

type MovieRef = { id: number; title: string; poster_path: string | null; imdb_id?: string | null }

export interface LayoutContext {
  user: ReturnType<typeof useAuth>['user']
  watchedIds: Set<number>
  watchedRows: WatchedRow[]
  refreshWatched: () => Promise<void>
  toggleWatched: (m: MovieRef) => Promise<void>
  watchlistIds: Set<number>
  watchlistRows: WatchlistRow[]
  refreshWatchlist: () => Promise<void>
  toggleWatchlist: (m: MovieRef) => Promise<void>
}

export function Layout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set())
  const [watchedRows, setWatchedRows] = useState<WatchedRow[]>([])
  const [watchlistIds, setWatchlistIds] = useState<Set<number>>(new Set())
  const [watchlistRows, setWatchlistRows] = useState<WatchlistRow[]>([])

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

  const refreshWatchlist = useCallback(async () => {
    if (!user) { setWatchlistIds(new Set()); setWatchlistRows([]); return }
    try {
      const rows = await listWatchlist()
      setWatchlistRows(rows)
      setWatchlistIds(new Set(rows.map((r) => r.tmdb_id)))
    } catch {
      setWatchlistIds(new Set())
      setWatchlistRows([])
    }
  }, [user])

  useEffect(() => { refreshWatched() }, [refreshWatched])
  useEffect(() => { refreshWatchlist() }, [refreshWatchlist])

  const toggleWatched = useCallback(async (m: MovieRef) => {
    if (!user) { navigate('/'); return }
    try {
      if (watchedIds.has(m.id)) await unmarkWatched(m.id)
      else await markWatched(m)
      await refreshWatched()
    } catch (e: any) { alert(e.message) }
  }, [user, watchedIds, refreshWatched, navigate])

  const toggleWatchlist = useCallback(async (m: MovieRef) => {
    if (!user) { navigate('/'); return }
    try {
      if (watchlistIds.has(m.id)) await removeFromWatchlist(m.id)
      else await addToWatchlist(m)
      await refreshWatchlist()
    } catch (e: any) { alert(e.message) }
  }, [user, watchlistIds, refreshWatchlist, navigate])

  const ctx: LayoutContext = {
    user,
    watchedIds, watchedRows, refreshWatched, toggleWatched,
    watchlistIds, watchlistRows, refreshWatchlist, toggleWatchlist,
  }

  const watchlistSuffix = user && watchlistIds.size > 0 ? ` (${watchlistIds.size})` : ''
  const watchedSuffix = user && watchedIds.size > 0 ? ` (${watchedIds.size})` : ''

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 backdrop-blur bg-[var(--color-bg)]/85 border-b border-[var(--color-border)]">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 flex items-center gap-4">
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
          <nav className="contents">
            <TabLink to="/">{t('nav.movies')}</TabLink>
            <TabLink to="/tv">{t('nav.tv')}</TabLink>
            <TabLink to="/calendar">{t('nav.calendar')}</TabLink>
            <TabLink to="/watchlist">{t('nav.watchlist')}{watchlistSuffix}</TabLink>
            <TabLink to="/watched">{t('nav.watched')}{watchedSuffix}</TabLink>
            {user && <TabLink to="/lists">{t('nav.lists')}</TabLink>}
            {user && <TabLink to="/stats">{t('nav.stats')}</TabLink>}
            {user && <TabLink to="/import">{t('nav.import')}</TabLink>}
          </nav>
          <PreferencesMenu className="ml-auto" />
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
