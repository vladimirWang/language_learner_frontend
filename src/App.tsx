import { Route, Routes } from 'react-router-dom'
import AdminLayout from './layout/AdminLayout'
import BuildsPage from './pages/BuildsPage'
import DashboardPage from './pages/DashboardPage'
import ListeningImportPage from './pages/ListeningImportPage'
import ListeningJobsPage from './pages/ListeningJobsPage'
import LevelsPage from './pages/LevelsPage'
import NotFoundPage from './pages/NotFoundPage'
import SpeakingExamPartsPage from './pages/SpeakingExamPartsPage'
import SpeakingPage from './pages/SpeakingPage'
import SpeakingTemplatesPage from './pages/SpeakingTemplatesPage'
import SpeakingPlansPage from './pages/SpeakingPlansPage'
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
        <Route path="levels" element={<LevelsPage />} />
        <Route path="speaking" element={<SpeakingPage />} />
        <Route path="speaking/exam-parts" element={<SpeakingExamPartsPage />} />
        <Route path="speaking-templates" element={<SpeakingTemplatesPage />} />
        <Route path="*" element={<NotFoundPage />} />
        <Route path="speaking/plans" element={<SpeakingPlansPage />} />
      </Route>
    </Routes>
  )
}
