import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BooksIcon,
  CaretDownIcon,
  CrosshairIcon,
  DesktopIcon,
  GearSixIcon,
  ListIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  NotePencilIcon,
  PulseIcon,
  SignOutIcon,
  SquaresFourIcon,
  SunIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { BrandMark } from './BrandMark'
import { CommandPalette } from './CommandPalette'
import { ThemeToggle } from './ThemeToggle'

interface NavItem {
  to: string
  label: string
  icon: Icon
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: SquaresFourIcon, end: true },
  { to: '/trends', label: 'Trends', icon: CrosshairIcon },
  { to: '/studio', label: 'Studio', icon: NotePencilIcon },
  { to: '/library', label: 'Library', icon: BooksIcon },
  { to: '/jobs', label: 'Jobs', icon: PulseIcon },
  { to: '/settings', label: 'Settings', icon: GearSixIcon },
]

function NavEntries({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Primary">
      {NAV_ITEMS.map(({ to, label, icon: NavIcon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
              isActive
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
            )
          }
        >
          <NavIcon className="size-4 shrink-0" />
          {label}
        </NavLink>
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
          <SunIcon className="size-4" /> Light
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark">
          <MoonIcon className="size-4" /> Dark
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system">
          <DesktopIcon className="size-4" /> System
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function handleLogout() {
    await logout()
    toast.info('Signed out.')
    navigate('/login')
  }

  return (
    <div className="min-h-svh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[var(--z-toast)] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 rounded-sm focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <BrandMark />
            <span className="font-semibold tracking-tight">Trend Discover</span>
          </Link>

          <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-md px-3 py-2 text-sm transition-colors duration-150',
                    isActive
                      ? 'font-medium text-foreground after:absolute after:inset-x-3 after:-bottom-[9px] after:h-0.5 after:bg-signal'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-8 items-center gap-3 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none sm:flex"
            >
              <MagnifyingGlassIcon className="size-3.5" />
              <span className="pr-8">Search</span>
              <kbd className="rounded-sm border border-border bg-surface-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Search"
              onClick={() => setPaletteOpen(true)}
              className="sm:hidden"
            >
              <MagnifyingGlassIcon className="size-4" />
            </Button>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="flex items-center gap-1.5 rounded-md p-0.5 transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <Avatar>
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                      {user?.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <CaretDownIcon className="hidden size-3 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate text-sm font-medium">{user?.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ThemeMenuItems />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <SignOutIcon className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Open navigation"
                  className="lg:hidden"
                >
                  <ListIcon className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent
                showCloseButton={false}
                className="inset-x-0 top-14 max-h-[calc(100dvh-3.5rem)] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto overscroll-contain rounded-none border-x-0 border-t-0 p-0 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top"
              >
                <DialogTitle className="sr-only">Navigation</DialogTitle>
                <div className="flex items-center justify-between px-5 pt-4 pb-1">
                  <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                    Navigate
                  </span>
                  <ThemeToggle />
                </div>
                <NavEntries onNavigate={() => setMobileNavOpen(false)} />
                <div className="border-t border-border p-4">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-surface-muted hover:text-foreground"
                  >
                    <SignOutIcon className="size-4" />
                    Sign out
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main id="main-content" key={location.pathname} className="route-enter">
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
