import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthButton } from './components/AuthButton'
import { PreferencesMenu } from './components/PreferencesMenu'
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
  const [menuOpen, setMenuOpen] = useState(false)

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

  const watchlistCount = user ? watchlistKeys.size : 0
  const watchedCount = user ? watchedKeys.size : 0
  const watchlistSuffix = watchlistCount > 0 ? ` (${watchlistCount})` : ''
  const watchedSuffix = watchedCount > 0 ? ` (${watchedCount})` : ''

  // The protected slice of the tree is auth-gated by RequireAuth, but
  // Layout itself also wraps a handful of public routes (e.g. a shared
  // public-list link). For those we still want the brand chrome and the
  // sign-in CTA, but the user-specific nav (watchlist/watched/...) only
  // makes sense once we have a session. `showNav` collapses the nav
  // surfaces in the unauthed case so the header stays minimal.
  const showNav = !authLoading && !!user

  return (
    <div className="min-h-full">
      {/* ───────────── Header ───────────── */}
      <header className="sticky top-0 z-30 backdrop-blur bg-[var(--color-bg)]/90 border-b border-[var(--color-border)] pt-safe pl-safe pr-safe">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 h-14 sm:h-16 flex items-center gap-3 sm:gap-4">
          {/* Mobile hamburger */}
          {showNav && (
            <button
              onClick={() => setMenuOpen(true)}
              aria-label={t('nav.menu')}
              className="lg:hidden -ml-1 inline-flex items-center justify-center h-10 w-10 rounded-lg hover:bg-[var(--color-surface)] transition"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          <Link to="/" className="hover:opacity-90 shrink-0">
            <span
              className="block leading-none"
              style={{
                fontFamily: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
                color: '#E50914',
                fontSize: 'clamp(1.5rem, 5vw, 1.875rem)',
                letterSpacing: '0.01em',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              BIRCEFLIX
            </span>
          </Link>

          {/* Desktop nav */}
          {showNav && (
            <nav className="hidden lg:flex items-center gap-1">
              <TabLink to="/">{t('nav.discover')}</TabLink>
              <TabLink to="/calendar">{t('nav.calendar')}</TabLink>
              <TabLink to="/watchlist">{t('nav.watchlist')}{watchlistSuffix}</TabLink>
              <TabLink to="/watched">{t('nav.watched')}{watchedSuffix}</TabLink>
              <TabLink to="/lists">{t('nav.lists')}</TabLink>
              <TabLink to="/import">{t('nav.import')}</TabLink>
            </nav>
          )}

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <PreferencesMenu />
            <AuthButton />
          </div>
        </div>
      </header>

      {/* ───────────── Mobile drawer menu ───────────── */}
      {showNav && menuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[82%] max-w-[320px] bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col pt-safe pl-safe"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--color-border)]">
              <span
                style={{
                  fontFamily: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
                  color: '#E50914',
                  fontSize: '1.5rem',
                }}
              >
                BIRCEFLIX
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label={t('common.close')}
                className="h-10 w-10 rounded-lg hover:bg-[var(--color-surface-2)] inline-flex items-center justify-center text-lg"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              <DrawerLink to="/"          onSelect={() => setMenuOpen(false)} icon="🔍">{t('nav.discover')}</DrawerLink>
              <DrawerLink to="/calendar"  onSelect={() => setMenuOpen(false)} icon="📅">{t('nav.calendar')}</DrawerLink>
              <DrawerLink to="/watchlist" onSelect={() => setMenuOpen(false)} icon="🔖" badge={watchlistCount}>{t('nav.watchlist')}</DrawerLink>
              <DrawerLink to="/watched"   onSelect={() => setMenuOpen(false)} icon="✓"  badge={watchedCount}>{t('nav.watched')}</DrawerLink>
              <DrawerLink to="/lists"     onSelect={() => setMenuOpen(false)} icon="📚">{t('nav.lists')}</DrawerLink>
              <DrawerLink to="/import"    onSelect={() => setMenuOpen(false)} icon="⇅">{t('nav.import')}</DrawerLink>
            </nav>
            <div className="p-3 border-t border-[var(--color-border)] pb-safe text-[11px] text-[var(--color-text-dim)] text-center">
              Birceflix
            </div>
          </aside>
        </>
      )}

      {/* ───────────── Main content ───────────── */}
      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 pl-safe pr-safe pb-safe-plus-16 lg:pb-6">
        <Outlet context={ctx} />
      </main>

      {/* ───────────── Mobile bottom nav (e-commerce style) ───────────── */}
      {showNav && (
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--color-bg)]/95 backdrop-blur border-t border-[var(--color-border)] pb-safe"
          aria-label="Primary"
        >
          <div className="grid grid-cols-5 h-14">
            <BottomTab to="/"          label={t('nav.discover')}  icon={DiscoverIcon} />
            <BottomTab to="/calendar"  label={t('nav.calendar')}  icon={CalendarIcon} />
            <BottomTab to="/watchlist" label={t('nav.watchlist')} icon={BookmarkIcon} badge={watchlistCount} />
            <BottomTab to="/watched"   label={t('nav.watched')}   icon={CheckIcon}    badge={watchedCount} />
            <BottomTab to="/lists"     label={t('nav.lists')}     icon={ListsIcon} />
          </div>
        </nav>
      )}
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

function DrawerLink({
  to, onSelect, icon, badge, children,
}: { to: string; onSelect: () => void; icon: string; badge?: number; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onSelect}
      className={({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] transition ${
          isActive
            ? 'bg-[var(--color-accent)] text-black font-medium'
            : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
        }`
      }
    >
      <span className="w-6 text-center text-base" aria-hidden>{icon}</span>
      <span className="flex-1">{children}</span>
      {badge != null && badge > 0 && (
        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-dim)] tabular-nums">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

function BottomTab({
  to, label, icon: Icon, badge,
}: { to: string; label: string; icon: (p: { active: boolean }) => React.ReactNode; badge?: number }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }: { isActive: boolean }) =>
        `relative flex flex-col items-center justify-center gap-0.5 text-[10px] transition ${
          isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-dim)]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon active={isActive} />
          <span className="leading-none truncate max-w-full px-1">{label}</span>
          {badge != null && badge > 0 && (
            <span className="absolute top-1 right-[18%] min-w-[16px] h-[16px] px-1 rounded-full bg-[#E50914] text-white text-[9px] font-semibold flex items-center justify-center leading-none">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

/* ───────── Bottom-nav icons (simple, mono-color, 22px) ───────── */
function svgProps(active: boolean) {
  return {
    width: 22, height: 22, viewBox: '0 0 24 24',
    fill: active ? 'currentColor' : 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}
function DiscoverIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps(active)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.65" y2="16.65" />
    </svg>
  )
}
function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps(active)}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  )
}
function BookmarkIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps(active)}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function CheckIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps(active)}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
function ListsIcon({ active }: { active: boolean }) {
  return (
    <svg {...svgProps(active)}>
      <line x1="8"  y1="6"  x2="21" y2="6" />
      <line x1="8"  y1="12" x2="21" y2="12" />
      <line x1="8"  y1="18" x2="21" y2="18" />
      <line x1="3"  y1="6"  x2="3.01" y2="6" />
      <line x1="3"  y1="12" x2="3.01" y2="12" />
      <line x1="3"  y1="18" x2="3.01" y2="18" />
    </svg>
  )
}
