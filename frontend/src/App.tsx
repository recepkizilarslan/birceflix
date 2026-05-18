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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
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
          <Route path="public/lists/:slug" element={<PublicListPage />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
      </Routes>
      <PWAUpdateToast />
    </BrowserRouter>
  )
}

export default App
