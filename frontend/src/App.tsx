import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { TrendExplorerPage } from '@/features/trends/TrendExplorerPage'
import { PostStudioPage } from '@/features/studio/PostStudioPage'
import { PostEditorPage } from '@/features/studio/PostEditorPage'
import { LibraryPage } from '@/features/library/LibraryPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/trends" element={<TrendExplorerPage />} />
              <Route path="/studio" element={<PostStudioPage />} />
              <Route path="/studio/:id" element={<PostEditorPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route
                path="*"
                element={
                  <div className="p-10 text-sm text-muted-foreground">
                    Screen coming in a later phase.
                  </div>
                }
              />
            </Route>
          </Route>
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  )
}
