import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { Discover } from './pages/Discover'
import { Watched } from './pages/Watched'
import { Watchlist } from './pages/Watchlist'
import { StatsPage } from './pages/Stats'
import { ImportPage } from './pages/Import'
import { MovieDetailPage } from './pages/MovieDetailPage'

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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
