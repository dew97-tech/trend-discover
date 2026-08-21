import { useEffect, useState } from 'react'
import { TrendingUp, Sparkles, PenLine, ClipboardCheck, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

interface DashboardData {
  new_trends: number
  high_potential: number
  generated_posts: number
  pending_review: number
  published: number
  recent_items_7d: number
  failed_jobs_24h: number
  trending_now: Array<{
    id: number
    title: string
    trend_score: string | null
    novelty_score: string | null
    item_count: number
    category?: { name: string } | null
  }>
}

const stats = [
  { key: 'new_trends', label: 'New Trends', icon: TrendingUp },
  { key: 'high_potential', label: 'High Potential', icon: Sparkles },
  { key: 'generated_posts', label: 'Generated Posts', icon: PenLine },
  { key: 'pending_review', label: 'Pending Review', icon: ClipboardCheck },
  { key: 'published', label: 'Published', icon: Send },
] as const

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<DashboardData>('/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
  }, [])

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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Trending Now
          </h2>
          {data && data.recent_items_7d > 0 ? (
            <span className="text-xs text-muted-foreground">
              {data.recent_items_7d} source items collected this week
            </span>
          ) : null}
        </div>

        {!data ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : data.trending_now.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            No scored trends yet — the scoring engine arrives in Phase 3.
            {data.recent_items_7d > 0
              ? ` ${data.recent_items_7d} raw items are already collected.`
              : ''}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.trending_now.map((trend) => (
              <Card key={trend.id}>
                <CardHeader className="pb-2">
                  {trend.category ? (
                    <Badge variant="secondary" className="w-fit text-xs">
                      {trend.category.name}
                    </Badge>
                  ) : null}
                  <CardTitle className="line-clamp-2 text-sm leading-snug">{trend.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-success">
                    Score {Number(trend.trend_score).toFixed(0)}
                  </span>
                  ·<span>{trend.item_count} signals</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {data && data.failed_jobs_24h > 0 ? (
        <p className="text-xs text-warning">
          ⚠ {data.failed_jobs_24h} pipeline job(s) failed in the last 24 hours.
        </p>
      ) : null}
    </div>
  )
}
