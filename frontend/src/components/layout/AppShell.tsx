import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  Activity,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
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
import { ThemeToggle } from './ThemeToggle'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Discover',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/trends', label: 'Trends', icon: Radar },
    ],
  },
  {
    label: 'Create',
    items: [
      { to: '/studio', label: 'Post Studio', icon: PenSquare },
      { to: '/library', label: 'Post Library', icon: Library },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/jobs', label: 'Automation', icon: Activity },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

const SIDEBAR_COLLAPSED_KEY = 'td_shell_sidebar_collapsed'

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

function NavEntries({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  return (
    <nav className={cn('flex-1 space-y-5 p-3', collapsed && 'px-2')}>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          {!collapsed ? (
            <p className="px-3 text-[11px] font-medium tracking-wide text-muted-foreground/70">
              {group.label}
            </p>
          ) : null}
          {group.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-md text-sm transition-colors',
                  collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
                  isActive
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed ? label : null}
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
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })

  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)

    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
    } catch {
      // Storage unavailable (private mode) — the toggle still works in-session.
    }
  }

  // main is the scroll container now — reset it on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])

  async function handleLogout() {
    await logout()
    toast.info('Signed out.')
    navigate('/login')
  }

  const renderUserMenu = (compact = false) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={compact ? 'Account menu' : undefined}
          className={cn(
            'flex w-full items-center rounded-md text-left transition-colors hover:bg-surface-muted',
            compact ? 'justify-center p-2' : 'gap-3 px-2 py-2',
          )}
        >
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {user?.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!compact ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user?.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
            </span>
          ) : null}
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
    <div className="flex h-svh overflow-hidden">
      {/* Desktop sidebar — collapsible icon rail */}
      <aside
        className={cn(
          'hidden min-h-0 shrink-0 flex-col overflow-y-auto border-r bg-surface transition-[width] duration-200 ease-out md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b',
            collapsed ? 'justify-center px-2' : 'gap-2 px-5',
          )}
        >
          {collapsed ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Expand sidebar"
              aria-expanded={false}
              onClick={toggleSidebar}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          ) : (
            <>
              <ProductMark />
              <span className="truncate font-semibold tracking-tight">Trend Discover</span>
              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Collapse sidebar"
                  aria-expanded
                  onClick={toggleSidebar}
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </div>
            </>
          )}
        </div>
        <NavEntries collapsed={collapsed} />
        <div className={cn('border-t', collapsed ? 'p-2' : 'p-3')}>
          {renderUserMenu(collapsed)}
        </div>
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
        <div className="ml-auto">
          <ThemeToggle />
        </div>
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
            <div className="border-t p-3">{renderUserMenu()}</div>
          </div>
        </div>
      ) : null}

      <main ref={mainRef} className="min-h-0 min-w-0 flex-1 overflow-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
