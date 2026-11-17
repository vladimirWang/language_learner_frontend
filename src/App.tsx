import { Route, Routes } from 'react-router-dom'
import AdminLayout from './layout/AdminLayout'
import BuildsPage from './pages/BuildsPage'
import DashboardPage from './pages/DashboardPage'
import ListeningImportPage from './pages/ListeningImportPage'
import ListeningJobsPage from './pages/ListeningJobsPage'
import NotFoundPage from './pages/NotFoundPage'
import VersionsPage from './pages/VersionsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="builds" element={<BuildsPage />} />
        <Route path="versions" element={<VersionsPage />} />
        <Route path="listening" element={<ListeningImportPage />} />
        <Route path="listening/jobs" element={<ListeningJobsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
