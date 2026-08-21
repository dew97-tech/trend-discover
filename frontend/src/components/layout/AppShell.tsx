import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Radar, PenSquare, Library, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/trends', label: 'Trend Explorer', icon: Radar },
  { to: '/studio', label: 'Post Studio', icon: PenSquare },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell() {
  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <span className="size-6 rounded-md bg-primary" aria-hidden />
          <span className="font-semibold tracking-tight">Trend Discover</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
