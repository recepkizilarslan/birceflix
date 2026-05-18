import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthButton } from './components/AuthButton'
import { PreferencesMenu } from './components/PreferencesMenu'
import { SignInScreen } from './components/SignInScreen'
import { useAuth } from './hooks/useAuth'
import { getWatchedKeySet, listWatched, markWatched, mediaKey, unmarkWatched, type MediaType, type WatchedRow } from './lib/watched'
import { addToWatchlist, listWatchlist, removeFromWatchlist, type WatchlistRow } from './lib/watchlist'

/** Minimal shape needed to upsert into watched/watchlist. media_type
 * disambiguates between TMDB movie id 550 and TV id 550. */
export type MediaRef = {
  id: number
  media_type: MediaType
  title: string
  poster_path: string | null
  imdb_id?: string | null
}

export interface LayoutContext {
  user: ReturnType<typeof useAuth>['user']
  /** Set of `${media_type}:${tmdb_id}` keys. Use mediaKey() from lib/watched. */
  watchedKeys: Set<string>
  watchedRows: WatchedRow[]
  refreshWatched: () => Promise<void>
  toggleWatched: (m: MediaRef) => Promise<void>
  watchlistKeys: Set<string>
  watchlistRows: WatchlistRow[]
  refreshWatchlist: () => Promise<void>
  toggleWatchlist: (m: MediaRef) => Promise<void>
}

export function Layout() {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set())
  const [watchedRows, setWatchedRows] = useState<WatchedRow[]>([])
  const [watchlistKeys, setWatchlistKeys] = useState<Set<string>>(new Set())
  const [watchlistRows, setWatchlistRows] = useState<WatchlistRow[]>([])

  const refreshWatched = useCallback(async () => {
    if (!user) { setWatchedKeys(new Set()); setWatchedRows([]); return }
    try {
      const rows = await listWatched()
      setWatchedRows(rows)
      setWatchedKeys(new Set(rows.map((r) => mediaKey(r.media_type, r.tmdb_id))))
    } catch {
      setWatchedKeys(await getWatchedKeySet())
    }
  }, [user])

  const refreshWatchlist = useCallback(async () => {
    if (!user) { setWatchlistKeys(new Set()); setWatchlistRows([]); return }
    try {
      const rows = await listWatchlist()
      setWatchlistRows(rows)
      setWatchlistKeys(new Set(rows.map((r) => mediaKey(r.media_type, r.tmdb_id))))
    } catch {
      setWatchlistKeys(new Set())
      setWatchlistRows([])
    }
  }, [user])

  useEffect(() => { refreshWatched() }, [refreshWatched])
  useEffect(() => { refreshWatchlist() }, [refreshWatchlist])

  const toggleWatched = useCallback(async (m: MediaRef) => {
    if (!user) { navigate('/'); return }
    const k = mediaKey(m.media_type, m.id)
    try {
      if (watchedKeys.has(k)) await unmarkWatched(m.id, m.media_type)
      else await markWatched(m)
      await refreshWatched()
    } catch (e: any) { alert(e.message) }
  }, [user, watchedKeys, refreshWatched, navigate])

  const toggleWatchlist = useCallback(async (m: MediaRef) => {
    if (!user) { navigate('/'); return }
    const k = mediaKey(m.media_type, m.id)
    try {
      if (watchlistKeys.has(k)) await removeFromWatchlist(m.id, m.media_type)
      else await addToWatchlist(m)
      await refreshWatchlist()
    } catch (e: any) { alert(e.message) }
  }, [user, watchlistKeys, refreshWatchlist, navigate])

  const ctx: LayoutContext = {
    user,
    watchedKeys, watchedRows, refreshWatched, toggleWatched,
    watchlistKeys, watchlistRows, refreshWatchlist, toggleWatchlist,
  }

  const watchlistSuffix = user && watchlistKeys.size > 0 ? ` (${watchlistKeys.size})` : ''
  const watchedSuffix = user && watchedKeys.size > 0 ? ` (${watchedKeys.size})` : ''

  // Auth gate: the whole app sits behind login. The hooks above still run
  // (they're cheap no-ops without a user), so the conditional return is
  // safe per the rules-of-hooks. The OAuth start endpoint lives at
  // /api/auth/google and is a hard navigation, so the gate doesn't block
  // sign-in.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--color-text-dim)] text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (!user) {
    return <SignInScreen />
  }

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
            <TabLink to="/">{t('nav.discover')}</TabLink>
            <TabLink to="/calendar">{t('nav.calendar')}</TabLink>
            <TabLink to="/watchlist">{t('nav.watchlist')}{watchlistSuffix}</TabLink>
            <TabLink to="/watched">{t('nav.watched')}{watchedSuffix}</TabLink>
            {user && <TabLink to="/lists">{t('nav.lists')}</TabLink>}
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
