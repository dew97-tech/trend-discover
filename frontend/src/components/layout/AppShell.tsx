import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  Activity,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PenSquare,
  Radar,
  Settings,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Intelligence',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/trends', label: 'Trends', icon: Radar },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/studio', label: 'Studio', icon: PenSquare },
      { to: '/library', label: 'Library', icon: Library },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/jobs', label: 'Jobs', icon: Activity },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

function ProductMark() {
  return (
    <span
      aria-hidden
      className="flex size-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold tracking-tight text-primary-foreground"
    >
      TD
    </span>
  )
}

function NavEntries({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-5 p-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 text-[11px] font-medium tracking-wide text-muted-foreground/70">
            {group.label}
          </p>
          {group.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

function ThemeMenuItems() {
  const { theme = 'system', setTheme } = useTheme()

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Theme
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
        <DropdownMenuRadioItem value="light">
          <Sun className="size-4" /> Light
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark">
          <Moon className="size-4" /> Dark
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system">
          <Monitor className="size-4" /> System
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  async function handleLogout() {
    await logout()
    toast.info('Signed out.')
    navigate('/login')
  }

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-muted"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {user?.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user?.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <ThemeMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <ProductMark />
          <span className="font-semibold tracking-tight">Trend Discover</span>
        </div>
        <NavEntries />
        <div className="border-t p-3">{userMenu}</div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b bg-surface px-4 md:hidden">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="size-4" />
        </Button>
        <ProductMark />
        <span className="font-semibold tracking-tight">Trend Discover</span>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r bg-surface">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="flex items-center gap-2 font-semibold tracking-tight">
                <ProductMark />
                Trend Discover
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <NavEntries onNavigate={() => setMobileNavOpen(false)} />
            <div className="border-t p-3">{userMenu}</div>
          </div>
        </div>
      ) : null}

      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
