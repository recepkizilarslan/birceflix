import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { Discover } from './pages/Discover'
import { Watched } from './pages/Watched'
import { MovieDetailPage } from './pages/MovieDetailPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Discover />} />
          <Route path="watched" element={<Watched />} />
          <Route path="movie/:id" element={<MovieDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
