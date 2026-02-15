import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import TeamSorterPage from './components/TeamSorterPage.tsx'
import PlayerManagementPage from './components/PlayerManagementPage.tsx'
import MatchdayListPage from './components/MatchdayListPage.tsx'
import MatchdayDetailPage from './components/MatchdayDetailPage.tsx'
import StatsPage from './components/StatsPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<MatchdayListPage />} />
          <Route path="matchdays/:id" element={<MatchdayDetailPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="sorter" element={<TeamSorterPage />} />
          <Route path="players" element={<PlayerManagementPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
