import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { TrendExplorerPage } from '@/features/trends/TrendExplorerPage'
import { PostStudioPage } from '@/features/studio/PostStudioPage'
import { PostEditorPage } from '@/features/studio/PostEditorPage'
import { LibraryPage } from '@/features/library/LibraryPage'
import { JobsPage } from '@/features/jobs/JobsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={200}>
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
                  <Route path="/jobs" element={<JobsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route
                    path="*"
                    element={
                      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-4 px-4 py-10 sm:px-6">
                        <span className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
                          404
                        </span>
                        <h1 className="font-serif text-4xl font-medium tracking-tight">
                          This page does not exist
                        </h1>
                        <p className="max-w-md text-sm text-muted-foreground">
                          The link may be outdated. Use the navigation to continue.
                        </p>
                        <Button asChild size="sm">
                          <Link to="/">Back to Overview</Link>
                        </Button>
                      </div>
                    }
                  />
                </Route>
              </Route>
            </Routes>
            <Toaster position="bottom-right" />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ErrorBoundary>
  )
}
