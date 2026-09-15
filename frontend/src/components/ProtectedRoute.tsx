import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { CircleNotchIcon } from '@phosphor-icons/react'
import { useAuth } from '@/features/auth/AuthProvider'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        <CircleNotchIcon className="size-6 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ redirect: location.pathname }} replace />
  }

  return <Outlet />
}
