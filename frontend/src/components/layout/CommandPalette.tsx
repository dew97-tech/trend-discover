import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BooksIcon,
  CrosshairIcon,
  GearSixIcon,
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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  group: string
  icon: Icon
  keywords?: string
  run: () => void
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { logout } = useAuth()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'overview',
        label: 'Overview',
        group: 'Go to',
        icon: SquaresFourIcon,
        run: () => navigate('/'),
      },
      {
        id: 'trends',
        label: 'Trends',
        group: 'Go to',
        icon: CrosshairIcon,
        keywords: 'explore radar signals',
        run: () => navigate('/trends'),
      },
      {
        id: 'studio',
        label: 'Studio',
        group: 'Go to',
        icon: NotePencilIcon,
        keywords: 'generate posts editor',
        run: () => navigate('/studio'),
      },
      {
        id: 'library',
        label: 'Library',
        group: 'Go to',
        icon: BooksIcon,
        keywords: 'archive posts',
        run: () => navigate('/library'),
      },
      {
        id: 'jobs',
        label: 'Jobs',
        group: 'Go to',
        icon: PulseIcon,
        keywords: 'pipeline runs logs',
        run: () => navigate('/jobs'),
      },
      {
        id: 'settings',
        label: 'Settings',
        group: 'Go to',
        icon: GearSixIcon,
        keywords: 'models sources configuration',
        run: () => navigate('/settings'),
      },
      {
        id: 'theme-light',
        label: 'Use light theme',
        group: 'Appearance',
        icon: SunIcon,
        run: () => setTheme('light'),
      },
      {
        id: 'theme-dark',
        label: 'Use dark theme',
        group: 'Appearance',
        icon: MoonIcon,
        run: () => setTheme('dark'),
      },
      {
        id: 'sign-out',
        label: 'Sign out',
        group: 'Account',
        icon: SignOutIcon,
        run: () => {
          void logout().then(() => {
            toast.info('Signed out.')
            navigate('/login')
          })
        },
      },
    ],
    [navigate, setTheme, logout],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return commands
    return commands.filter((command) =>
      `${command.label} ${command.group} ${command.keywords ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [commands, query])

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function handleOpenChange(next: boolean) {
    if (next) {
      setQuery('')
      setActiveIndex(0)
    }
    onOpenChange(next)
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    setActiveIndex(0)
  }

  function select(index: number) {
    const command = filtered[index]
    if (!command) return
    onOpenChange(false)
    command.run()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(filtered.length - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      select(activeIndex)
    }
  }

  const activeId = filtered[activeIndex] ? `command-${filtered[activeIndex].id}` : undefined

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <div className="border-b border-border transition-colors duration-150 focus-within:border-signal/50">
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="command-list"
            aria-activedescendant={activeId}
            aria-label="Search commands"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or page name…"
            spellCheck={false}
            className="h-11 w-full bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          id="command-list"
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="max-h-80 overflow-y-auto overscroll-contain p-1.5"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No commands match “{query.trim()}”.
            </p>
          ) : (
            filtered.map((command, index) => {
              const CommandIcon = command.icon
              const active = index === activeIndex
              return (
                <button
                  key={command.id}
                  id={`command-${command.id}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-active={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-100',
                    active ? 'bg-accent text-accent-foreground' : 'text-foreground',
                  )}
                >
                  <CommandIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  <span className="shrink-0 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                    {command.group}
                  </span>
                </button>
              )
            })
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground">
          <span>↑↓ move</span>
          <span>↵ run</span>
          <span>esc close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
