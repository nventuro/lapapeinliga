import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import TeamSorterPage from './components/TeamSorterPage.tsx'
import PlantelPage from './components/PlantelPage.tsx'
import EventListPage from './components/EventListPage.tsx'
import EventDetailPage from './components/EventDetailPage.tsx'
import StatsPage from './components/StatsPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Navigate to="/fechas" replace />} />
          <Route path="fechas" element={<EventListPage />} />
          <Route path="fechas/:id" element={<EventDetailPage />} />
          <Route path="estadisticas" element={<StatsPage />} />
          <Route path="armado" element={<TeamSorterPage />} />
          <Route path="plantel" element={<PlantelPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
