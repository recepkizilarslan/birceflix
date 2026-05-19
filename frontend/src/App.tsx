import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
      <Routes>
        {/* Sign-in lives outside Layout so the marquee/hero gets the
            full viewport without competing with the app chrome. */}
        <Route path="/login" element={<SignInScreen />} />

        <Route element={<Layout />}>
          {/* Public — shareable links keep working for logged-out
              visitors. Layout hides the auth-only nav surfaces when
              there's no session. */}
          <Route path="public/lists/:slug" element={<PublicListPage />} />

          {/* Everything below requires a session */}
          <Route element={<RequireAuth />}>
            <Route index element={<Discover />} />
            <Route path="watched" element={<Watched />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="movie/:id" element={<MovieDetailPage />} />
            {/* /tv is the old separate TV discover route — redirect into the unified discover */}
            <Route path="tv" element={<Navigate to="/?type=tv" replace />} />
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

export default App
