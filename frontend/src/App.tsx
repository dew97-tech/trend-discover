import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/DashboardPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="*"
            element={
              <div className="p-10 text-sm text-muted-foreground">
                Screen coming in a later phase.
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
