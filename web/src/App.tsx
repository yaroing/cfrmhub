import { I18nextProvider } from 'react-i18next'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import i18n from './i18n'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { AuthProvider, useRole } from './hooks/useAuth'
import { canAdmin, canSubmitFeedback, canViewAnalytics } from './utils/permissions'
import { ThemeProvider } from './hooks/useTheme'
import { AdminAuditPage } from './pages/admin/AdminAuditPage'
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage'
import { AdminChannelsPage } from './pages/admin/AdminChannelsPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { DashboardPage } from './pages/DashboardPage'
import { FeedbackDetailPage } from './pages/FeedbackDetailPage'
import { HomePage } from './pages/HomePage'
import { PublicLegalPage } from './pages/PublicLegalPage'
import { LoginPage } from './pages/LoginPage'
import { PublicFeedbackPage } from './pages/PublicFeedbackPage'
import { ActionDetailPage } from './pages/ActionDetailPage'
import { ActionTrackerPage } from './pages/ActionTrackerPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { FieldSubmitPage } from './pages/FieldSubmitPage'
import { AdminFocalPointsPage } from './pages/admin/AdminFocalPointsPage'
import { AdminAiInsightPage } from './pages/admin/AdminAiInsightPage'
import type { ReactNode } from 'react'

function AdminGate({ children }: { children: ReactNode }) {
  const role = useRole()
  if (!canAdmin(role)) return <Navigate to="/app" replace />
  return children
}

function AnalyticsGate({ children }: { children: ReactNode }) {
  const role = useRole()
  if (role === 'field_agent') return <Navigate to="/app/intake" replace />
  if (!canViewAnalytics(role)) return <Navigate to="/app" replace />
  return children
}

function ActionsGate({ children }: { children: ReactNode }) {
  const role = useRole()
  if (role === 'field_agent') return <Navigate to="/app/intake" replace />
  return children
}

function IntakeGate({ children }: { children: ReactNode }) {
  const role = useRole()
  if (!canSubmitFeedback(role)) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="flex min-h-screen flex-1 flex-col">
            <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/feedback" element={<PublicFeedbackPage />} />
              <Route path="/legal/:page" element={<PublicLegalPage />} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<DashboardLayout />}>
              <Route index element={<DashboardPage />} />
              <Route
                path="intake"
                element={
                  <IntakeGate>
                    <FieldSubmitPage />
                  </IntakeGate>
                }
              />
              <Route path="field" element={<Navigate to="/app/intake" replace />} />
              <Route path="feedback/:id" element={<FeedbackDetailPage />} />
              <Route
                path="actions"
                element={
                  <ActionsGate>
                    <ActionTrackerPage />
                  </ActionsGate>
                }
              />
              <Route
                path="actions/:id"
                element={
                  <ActionsGate>
                    <ActionDetailPage />
                  </ActionsGate>
                }
              />
              <Route
                path="analytics"
                element={
                  <AnalyticsGate>
                    <AnalyticsPage />
                  </AnalyticsGate>
                }
              />
              <Route
                path="admin/users"
                element={
                  <AdminGate>
                    <AdminUsersPage />
                  </AdminGate>
                }
              />
              <Route
                path="admin/categories"
                element={
                  <AdminGate>
                    <AdminCategoriesPage />
                  </AdminGate>
                }
              />
              <Route
                path="admin/channels"
                element={
                  <AdminGate>
                    <AdminChannelsPage />
                  </AdminGate>
                }
              />
              <Route
                path="admin/ai-insight"
                element={
                  <AdminGate>
                    <AdminAiInsightPage />
                  </AdminGate>
                }
              />
              <Route
                path="admin/audit"
                element={
                  <AdminGate>
                    <AdminAuditPage />
                  </AdminGate>
                }
              />
              <Route
                path="admin/focal-points"
                element={
                  <AdminGate>
                    <AdminFocalPointsPage />
                  </AdminGate>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  )
}
