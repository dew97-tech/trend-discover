import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CircleNotchIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandMark } from '@/components/layout/BrandMark'
import { useAuth } from '@/features/auth/AuthProvider'
import { ApiError } from '@/lib/api'

const SIGNALS = [
  'Hacker News · GitHub · Lobste.rs',
  'Dev.to · RSS feeds · YouTube',
  'Scored for novelty, not just buzz',
]

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo = (location.state as { redirect?: string } | null)?.redirect ?? '/'
  const isReauth = Boolean((location.state as { reauth?: boolean } | null)?.reauth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user && !isReauth) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await login(email, password)
      toast.success('Signed in.')
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden flex-col justify-between border-r border-border bg-surface p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-semibold tracking-tight">Trend Discover</span>
        </div>

        <div className="space-y-4">
          <p className="max-w-md font-serif text-4xl leading-[1.35] font-medium tracking-tight">
            Software engineering trends, scored before they saturate.
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Collect stories across six sources, rank them by novelty and practical value, then
            turn the best ones into posts you can publish.
          </p>
        </div>

        <ul className="space-y-2">
          {SIGNALS.map((signal) => (
            <li
              key={signal}
              className="font-mono text-xs text-muted-foreground"
            >
              {signal}
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm space-y-7">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 lg:hidden">
              <BrandMark />
              <span className="font-semibold tracking-tight">Trend Discover</span>
            </div>
            <h1 className="pt-2 font-serif text-2xl font-medium tracking-tight">
              {isReauth ? 'Session ending' : 'Sign in'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isReauth
                ? 'Re-enter your password to continue your session.'
                : 'Sessions last 60 minutes, then you sign in again.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
              {isReauth ? 'Stay signed in' : 'Sign in'}
            </Button>

            {!isReauth ? (
              <p className="text-sm text-muted-foreground">
                No account?{' '}
                <Link to="/register" className="font-medium text-signal hover:underline">
                  Create one
                </Link>
              </p>
            ) : null}
          </form>
        </div>
      </main>
    </div>
  )
}
