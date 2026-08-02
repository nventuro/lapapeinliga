import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import TeamSorterPage from './components/TeamSorterPage.tsx'
import PlantelPage from './components/PlantelPage.tsx'
import PlayerPage from './components/PlayerPage.tsx'
import EventListPage from './components/EventListPage.tsx'
import EventDetailPage from './components/EventDetailPage.tsx'
import StatsPage from './components/StatsPage.tsx'
import GalleryPage from './components/GalleryPage.tsx'
import TrophyListPage from './components/TrophyListPage.tsx'
import TrophyDetailPage from './components/TrophyDetailPage.tsx'
import ClaimPage from './components/ClaimPage.tsx'

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
          <Route path="plantel/:id" element={<PlayerPage />} />
          <Route path="trofeos" element={<TrophyListPage />} />
          <Route path="trofeos/:id" element={<TrophyDetailPage />} />
          <Route path="galeria" element={<GalleryPage />} />
          <Route path="vincular" element={<ClaimPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
