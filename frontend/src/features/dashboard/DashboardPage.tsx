import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  PenLine,
  Send,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { HelpTip } from '@/components/shared/HelpTip'
import { PageHeader } from '@/components/shared/PageHeader'
import { PostCard } from '@/components/shared/PostCard'
import { ScorePill } from '@/components/shared/ScorePill'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { StatTile } from '@/components/shared/StatTile'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { contentFormatLabel } from '@/lib/content-formats'
import { api } from '@/lib/api'
import { FormatPickerDialog } from '@/features/trends/FormatPickerDialog'
import type { Trend } from '@/features/trends/types'

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

const STATS: Array<{
  key: keyof DashboardData
  label: string
  icon: typeof TrendingUp
  help: string
}> = [
  {
    key: 'new_trends',
    label: 'New trends',
    icon: TrendingUp,
    help: 'Trends discovered in the current collection window.',
  },
  {
    key: 'high_potential',
    label: 'High potential',
    icon: Sparkles,
    help: 'Active trends scoring 75 or higher — your best posting candidates.',
  },
  {
    key: 'generated_posts',
    label: 'Generated posts',
    icon: PenLine,
    help: 'Every draft, variant and published post in the workspace.',
  },
  {
    key: 'pending_review',
    label: 'Pending review',
    icon: ClipboardCheck,
    help: 'Posts in Review or Ready state waiting on your decision.',
  },
  {
    key: 'published',
    label: 'Published',
    icon: Send,
    help: 'Posts you marked as published on LinkedIn.',
  },
]

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [pickerTrend, setPickerTrend] = useState<Trend | null>(null)
  const navigate = useNavigate()

  const load = useCallback(() => {
    api<DashboardData>('/dashboard')
      .then(setData)
      .catch(() => toast.error('Failed to load the overview.'))
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-6">
      <PageHeader
        title="Overview"
        description="Software engineering trends worth posting about — refreshed continuously."
      />

      {data && data.failed_jobs_24h > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <TriangleAlert className="size-4 shrink-0" />
          <span>
            {data.failed_jobs_24h} pipeline job{data.failed_jobs_24h === 1 ? '' : 's'} failed in the
            last 24 hours.
          </span>
          <Button asChild variant="outline" size="xs" className="ml-auto">
            <Link to="/jobs">Open Jobs</Link>
          </Button>
        </div>
      ) : null}

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATS.map(({ key, label, icon, help }) => (
          <StatTile
            key={key}
            label={label}
            icon={icon}
            help={help}
            value={data ? (data[key] as number) : null}
          />
        ))}
      </section>

      {/* Recommended topics */}
      <section className="space-y-3">
        <SectionHeader
          title="Recommended topics"
          help={
            <HelpTip text="Top-ranked trends by composite score. Prefer low saturation and high novelty — those are the stories not already everywhere on LinkedIn." />
          }
          actions={
            <Button asChild variant="ghost" size="xs">
              <Link to="/trends">Explore all</Link>
            </Button>
          }
        />

        {!data ? (
          <Skeleton className="h-44 rounded-lg" />
        ) : data.recommended.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No recommendations yet"
            description="Run a collection to populate this list."
          />
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {data.recommended.map((trend) => (
                <div key={trend.id} className="flex items-center gap-3 px-4 py-3">
                  <ScorePill score={trend.scores.trend} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{trend.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {trend.category?.name ?? 'Uncategorized'} · novelty{' '}
                      {Math.round(trend.scores.novelty)}
                      {trend.hack_style ? ' · hack' : ''}
                      {trend.has_post ? ' · variant exists' : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={trend.has_post ? 'outline' : 'default'}
                    onClick={() => setPickerTrend(trend)}
                  >
                    <Sparkles className="size-3.5" />
                    Generate
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Trending now */}
      <section className="space-y-3">
        <SectionHeader
          title="Trending now"
          help={
            <HelpTip text="Highest-scoring active trends across all sources. Focus topics and hack-style content get a ranking boost." />
          }
          actions={
            data && data.recent_items_7d > 0 ? (
              <Button asChild variant="ghost" size="xs">
                <Link to="/trends">Explore all</Link>
              </Button>
            ) : null
          }
        />

        {!data ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : data.trending_now.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No scored trends yet"
            description="Collectors are still warming up."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.trending_now.map((trend) => (
              <Card
                key={trend.id}
                onClick={() => navigate('/trends')}
                className="cursor-pointer transition-colors hover:border-primary/40"
              >
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {trend.category?.name ?? 'Uncategorized'}
                    </span>
                    <ScorePill score={trend.scores.trend} />
                  </div>
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{trend.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {trend.item_count} signal{trend.item_count === 1 ? '' : 's'} · novelty{' '}
                    {Math.round(trend.scores.novelty)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Publishing queue */}
      <section className="space-y-3">
        <SectionHeader
          title="Publishing queue"
          help={
            <HelpTip text="Posts the quality gate routed to Review or Ready. Open one, polish it, then copy it into LinkedIn." />
          }
          actions={
            data && data.queue_count > 0 ? (
              <Button asChild variant="ghost" size="xs">
                <Link to="/library">Open Library</Link>
              </Button>
            ) : null
          }
        />

        {!data ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : data.queue_count === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing waiting"
            description="Posts routed to Review or Ready will appear here."
          />
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
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
                  >
                    <StatusBadge status={post.status} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{(post.hook ?? post.title) || '(untitled)'}</p>
                      <p className="text-xs text-muted-foreground">
                        {contentFormatLabel(post.format)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      Quality {post.quality_score !== null ? Math.round(post.quality_score) : '—'}
                    </span>
                  </button>
                ))}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recent content */}
      <section className="space-y-3">
        <SectionHeader
          title="Recent content"
          actions={
            data && data.generated_posts > 0 ? (
              <Button asChild variant="ghost" size="xs">
                <Link to="/studio">Open Studio</Link>
              </Button>
            ) : null
          }
        />

        {!data ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : data.recent_content.length === 0 ? (
          <EmptyState
            icon={PenLine}
            title="No posts yet"
            description="Pick a recommended topic above to generate your first post."
          />
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

      <FormatPickerDialog
        trendId={pickerTrend?.id ?? 0}
        open={pickerTrend !== null}
        onOpenChange={(open) => !open && setPickerTrend(null)}
        onQueued={() => {
          toast.success('Generation queued — it will appear in Studio shortly.')
          setTimeout(load, 4000)
        }}
      />
    </div>
  )
}
