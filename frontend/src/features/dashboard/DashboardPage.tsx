import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ClipboardCheck,
  PenLine,
  Send,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { FormatPickerDialog } from '@/features/trends/FormatPickerDialog'
import type { Trend } from '@/features/trends/types'
import { scoreTier } from '@/features/trends/types'
import { PostCard } from '@/components/shared/PostCard'
import { cn } from '@/lib/utils'

interface DashboardData {
  new_trends: number
  high_potential: number
  generated_posts: number
  pending_review: number
  published: number
  queue_count: number
  recent_items_7d: number
  failed_jobs_24h: number
  trending_now: Trend[]
  recommended: Trend[]
  recent_content: Array<{
    id: number
    title: string | null
    hook: string | null
    status: string
    format: string
    quality_score: number | null
    trend_title?: string | null
    updated_at: string | null
  }>
}

const stats = [
  { key: 'new_trends', label: 'New Trends', icon: TrendingUp },
  { key: 'high_potential', label: 'High Potential', icon: Sparkles },
  { key: 'generated_posts', label: 'Generated Posts', icon: PenLine },
  { key: 'pending_review', label: 'Pending Review', icon: ClipboardCheck },
  { key: 'published', label: 'Published', icon: Send },
] as const

const TIER_STYLES = {
  high: 'bg-success-soft text-success',
  medium: 'bg-warning-soft text-warning',
  low: 'bg-surface-muted text-muted-foreground',
} as const

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickerTrend, setPickerTrend] = useState<Trend | null>(null)
  const navigate = useNavigate()

  const load = useCallback(() => {
    api<DashboardData>('/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Today's Intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Software engineering trends worth posting about — updated continuously.
        </p>
      </header>

      {error ? (
        <div className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      {/* Stats row */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(({ key, label, icon: Icon }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="size-3.5" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data ? (
                <span className="text-2xl font-semibold tabular-nums">{data[key]}</span>
              ) : (
                <Skeleton className="h-7 w-12" />
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Recommended Topics — action list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Zap className="size-4 text-primary" />
            Recommended Topics
          </h2>
          {data && data.recommended.length > 0 ? (
            <span className="text-xs text-muted-foreground">top ranked</span>
          ) : null}
        </div>

        {!data ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : data.recommended.length === 0 ? (
          <EmptyHint text="Run a collection to populate recommendations." />
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {data.recommended.map((trend) => (
                <div key={trend.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                      TIER_STYLES[scoreTier(trend.scores.trend)],
                    )}
                  >
                    {Math.round(trend.scores.trend)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{trend.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {trend.category?.name ?? 'Uncategorized'} · novelty{' '}
                      {Math.round(trend.scores.novelty)} · sat {Math.round(trend.scores.saturation)}
                      {trend.has_post ? ' · post exists ✓' : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={trend.has_post ? 'outline' : 'default'}
                    onClick={() => setPickerTrend(trend)}
                  >
                    Generate Post
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Trending Now */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Trending Now
          </h2>
          {data && data.recent_items_7d > 0 ? (
            <Link to="/trends" className="text-xs text-primary hover:underline">
              Explore all →
            </Link>
          ) : null}
        </div>

        {!data ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : data.trending_now.length === 0 ? (
          <EmptyHint text="No scored trends yet — collectors are still warming up." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.trending_now.map((trend) => {
              const tier = scoreTier(trend.scores.trend)

              return (
                <Card
                  key={trend.id}
                  onClick={() => navigate('/trends')}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      {trend.category ? (
                        <Badge variant="secondary" className="text-xs">
                          {trend.category.name}
                        </Badge>
                      ) : (
                        <span />
                      )}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                          TIER_STYLES[tier],
                        )}
                      >
                        {Math.round(trend.scores.trend)}
                      </span>
                    </div>
                    <p className="line-clamp-2 pt-1 text-sm leading-snug">{trend.title}</p>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{trend.item_count} signal{trend.item_count === 1 ? '' : 's'}</span>
                    ·<span>novelty {Math.round(trend.scores.novelty)}</span>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Publishing Queue */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Publishing Queue
          </h2>
          {data && data.queue_count > 0 ? (
            <Link to="/library" className="text-xs text-primary hover:underline">
              Open library →
            </Link>
          ) : null}
        </div>

        {!data ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : data.queue_count === 0 ? (
          <EmptyHint text="Nothing waiting for review or publishing." />
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {data.recent_content
                .filter((p) => ['review', 'ready'].includes(p.status))
                .slice(0, 5)
                .map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => navigate(`/studio/${post.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted"
                  >
                    <PostStatusPill status={post.status} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{(post.hook ?? post.title) || '(untitled)'}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {post.format.replaceAll('_', ' ')}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      Q{post.quality_score !== null ? Math.round(post.quality_score) : '—'}
                    </span>
                  </button>
                ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recent Content */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Content
          </h2>
          {data && data.generated_posts > 0 ? (
            <Link to="/studio" className="text-xs text-primary hover:underline">
              Post Studio →
            </Link>
          ) : null}
        </div>

        {!data ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : data.recent_content.length === 0 ? (
          <EmptyHint text="No posts yet — pick a recommended topic above." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {data.recent_content.map((post) => (
              <PostCard
                key={post.id}
                format={post.format}
                status={post.status}
                title={post.title}
                hook={post.hook}
                qualityScore={post.quality_score}
                onClick={() => navigate(`/studio/${post.id}`)}
                metaLeft={
                  <span>{new Date(post.updated_at ?? Date.now()).toLocaleDateString()}</span>
                }
              />
            ))}
          </div>
        )}
      </section>

      {data && data.failed_jobs_24h > 0 ? (
        <p className="text-xs text-warning">
          ⚠ {data.failed_jobs_24h} pipeline job(s) failed in the last 24 hours.
        </p>
      ) : null}

      <FormatPickerDialog
        trendId={pickerTrend?.id ?? 0}
        open={pickerTrend !== null}
        onOpenChange={(open) => !open && setPickerTrend(null)}
        onQueued={() => {
          toast.success('Generation queued — check Recent Content in a few seconds.')
          setTimeout(load, 4000)
        }}
      />
    </div>
  )
}

function PostStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
        status === 'ready' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
      )}
    >
      {status}
    </span>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}
