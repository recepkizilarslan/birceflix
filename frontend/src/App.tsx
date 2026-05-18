import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { Discover } from './pages/Discover'
import { Watched } from './pages/Watched'
import { Watchlist } from './pages/Watchlist'
import { StatsPage } from './pages/Stats'
import { ImportPage } from './pages/Import'
import { MovieDetailPage } from './pages/MovieDetailPage'
import { TvDiscover } from './pages/TvDiscover'
import { TvDetailPage } from './pages/TvDetailPage'
import { ListsPage } from './pages/Lists'
import { ListDetailPage } from './pages/ListDetail'
import { PublicListPage } from './pages/PublicList'
import { PWAUpdateToast } from './components/PWAUpdateToast'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Discover />} />
          <Route path="watched" element={<Watched />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="movie/:id" element={<MovieDetailPage />} />
          <Route path="tv" element={<TvDiscover />} />
          <Route path="tv/:id" element={<TvDetailPage />} />
          <Route path="lists" element={<ListsPage />} />
          <Route path="lists/:id" element={<ListDetailPage />} />
          <Route path="public/lists/:slug" element={<PublicListPage />} />
        </Route>
      </Routes>
      <PWAUpdateToast />
    </BrowserRouter>
  )
}

export default App
