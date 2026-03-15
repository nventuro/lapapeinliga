import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import TeamSorterPage from './components/TeamSorterPage.tsx'
import PlantelPage from './components/PlantelPage.tsx'
import MatchdayListPage from './components/MatchdayListPage.tsx'
import MatchdayDetailPage from './components/MatchdayDetailPage.tsx'
import StatsPage from './components/StatsPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Navigate to="/fechas" replace />} />
          <Route path="fechas" element={<MatchdayListPage />} />
          <Route path="fechas/:id" element={<MatchdayDetailPage />} />
          <Route path="estadisticas" element={<StatsPage />} />
          <Route path="armado" element={<TeamSorterPage />} />
          <Route path="plantel" element={<PlantelPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
