import { Route, Routes } from 'react-router-dom'
import AdminLayout from './layout/AdminLayout'
import BuildsPage from './pages/BuildsPage'
import DashboardPage from './pages/DashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import VersionsPage from './pages/VersionsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="builds" element={<BuildsPage />} />
        <Route path="versions" element={<VersionsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
