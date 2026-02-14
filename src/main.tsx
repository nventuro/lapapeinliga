import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import TeamSorterPage from './components/TeamSorterPage.tsx'
import PlayerManagementPage from './components/PlayerManagementPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<TeamSorterPage />} />
          <Route path="players" element={<PlayerManagementPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
