import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { Layout } from './Layout'
import { Discover } from './pages/Discover'
import { Watched } from './pages/Watched'
import { Watchlist } from './pages/Watchlist'
import { ImportPage } from './pages/Import'
import { MovieDetailPage } from './pages/MovieDetailPage'
import { TvDetailPage } from './pages/TvDetailPage'
import { ListsPage } from './pages/Lists'
import { ListDetailPage } from './pages/ListDetail'
import { PublicListPage } from './pages/PublicList'
import { CalendarPage } from './pages/Calendar'
import { PWAUpdateToast } from './components/PWAUpdateToast'
import { RequireAuth } from './components/RequireAuth'
import { SignInScreen } from './components/SignInScreen'

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Sign-in lives outside Layout so the marquee/hero gets the
            full viewport without competing with the app chrome. */}
        <Route path="/login" element={<SignInScreen />} />

        <Route element={<Layout />}>
          {/* Public — shareable links keep working for logged-out
              visitors. Layout hides the auth-only nav surfaces when
              there's no session. */}
          <Route path="public/lists/:slug" element={<PublicListPage />} />

          {/* Everything below requires a session. Discover is the homepage,
              but it lives at /discover so it can be linked, bookmarked, and
              shared explicitly. Root redirects there while preserving any
              query string (old shared `/?type=tv` style links still resolve
              to the right state). */}
          <Route element={<RequireAuth />}>
            <Route index element={<RedirectToDiscover />} />
            <Route path="discover" element={<Discover />} />
            <Route path="watched" element={<Watched />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="movie/:id" element={<MovieDetailPage />} />
            {/* /tv is the old separate TV discover route — redirect into the unified discover */}
            <Route path="tv" element={<Navigate to="/discover?type=tv" replace />} />
            <Route path="tv/:id" element={<TvDetailPage />} />
            <Route path="lists" element={<ListsPage />} />
            <Route path="lists/:id" element={<ListDetailPage />} />
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
        </Route>
      </Routes>
      <PWAUpdateToast />
    </BrowserRouter>
  )
}

/** Preserves the query string while redirecting `/` → `/discover` so legacy
 *  links like `/?type=tv&g=18` keep working after the route move. */
function RedirectToDiscover() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/discover', search }} replace />
}

function ScrollToTop() {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  useEffect(() => {
    if (navType !== 'POP') {
      window.scrollTo(0, 0)
    }
  }, [pathname, navType])
  return null
}

export default App
