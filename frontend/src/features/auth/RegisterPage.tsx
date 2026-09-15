import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CircleNotchIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandMark } from '@/components/layout/BrandMark'
import { useAuth } from '@/features/auth/AuthProvider'
import { ApiError } from '@/lib/api'

const SIGNALS = [
  'Six sources, collected continuously',
  'Scored for novelty and usefulness',
  'Posts drafted from the research',
]

export function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await register(name, email, password, confirmation)
      toast.success(`Account created — welcome, ${name.split(' ')[0]}.`)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setError(Object.values(err.errors).flat()[0] ?? err.message)
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
      }
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
          <p className="max-w-md font-serif text-4xl leading-[1.08] font-medium tracking-tight">
            Find what is worth discussing, before it is everywhere.
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            The workspace ranks incoming engineering stories, groups them into trends, and
            drafts posts grounded in the sources behind them.
          </p>
        </div>

        <ul className="space-y-2">
          {SIGNALS.map((signal) => (
            <li
              key={signal}
              className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase"
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
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Sessions last 60 minutes. Your drafts are shared with the workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error ? (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
              Create account
            </Button>

            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-signal hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
