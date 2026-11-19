import { Spin } from 'antd'
import { useEffect, useState } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import { verifySsoSession } from './auth'
import AdminLayout from './layout/AdminLayout'
import BuildsPage from './pages/BuildsPage'
import DashboardPage from './pages/DashboardPage'
import ExamLibraryPage from './pages/ExamLibraryPage'
import ListeningImportPage from './pages/ListeningImportPage'
import ListeningJobsPage from './pages/ListeningJobsPage'
import LevelsPage from './pages/LevelsPage'
import NotificationsPage from './pages/NotificationsPage'
import LoginPage from './pages/LoginPage'
import SsoCallbackPage from './pages/SsoCallbackPage'
import PdfBlocksPage from './pages/PdfBlocksPage'
import PdfImportPage from './pages/PdfImportPage'
import NotFoundPage from './pages/NotFoundPage'
import SpeakingExamPartsPage from './pages/SpeakingExamPartsPage'
import SpeakingPage from './pages/SpeakingPage'
import SpeakingPlansPage from './pages/SpeakingPlansPage'
import SpeakingTemplatesPage from './pages/SpeakingTemplatesPage'
import VocabPage from './pages/VocabPage'
import VersionsPage from './pages/VersionsPage'

/**
 * 登录守卫：进入管理台前校验 SSO 会话。
 * 网络异常时 verifySsoSession 会保留本地会话，避免 SSO 短暂不可用导致无法进入。
 */
function RequireAuth() {
  const [status, setStatus] = useState<'checking' | 'auth' | 'anon'>('checking')

  useEffect(() => {
    void verifySsoSession().then((user) => setStatus(user ? 'auth' : 'anon'))
  }, [])

  if (status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (status === 'anon') {
    return <LoginPage />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/sso/callback" element={<SsoCallbackPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="builds" element={<BuildsPage />} />
          <Route path="versions" element={<VersionsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="listening" element={<ListeningImportPage />} />
          <Route path="listening/jobs" element={<ListeningJobsPage />} />
          <Route path="levels" element={<LevelsPage />} />
          <Route path="pdf-import" element={<PdfImportPage />} />
          <Route path="pdf-import/:jobId" element={<PdfBlocksPage />} />
          <Route path="exam" element={<ExamLibraryPage />} />
          <Route path="speaking" element={<SpeakingPage />} />
          <Route path="speaking/exam-parts" element={<SpeakingExamPartsPage />} />
          <Route path="speaking/plans" element={<SpeakingPlansPage />} />
          <Route path="speaking-templates" element={<SpeakingTemplatesPage />} />
          <Route path="vocab" element={<VocabPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
