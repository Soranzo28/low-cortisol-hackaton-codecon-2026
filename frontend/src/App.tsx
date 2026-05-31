import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/routes'
import Home from '@/pages/Home'
import RoomPage from '@/pages/Room'
import About from '@/pages/About'


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.HOME} element={<Home />} />
        <Route path={ROUTES.ROOM} element={<RoomPage />} />
        <Route path={ROUTES.ABOUT} element={<About />} />
        {/* Catch-all → home */}
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
