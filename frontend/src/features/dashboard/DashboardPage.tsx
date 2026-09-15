import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ClipboardIcon,
  ClipboardTextIcon,
  LightningIcon,
  SparkleIcon,
  TrendUpIcon,
  WarningIcon,
} from '@phosphor-icons/react'
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

interface TodayPost {
  id: number
  title: string | null
  hook: string | null
  body: string
  hashtags: string[]
  format: string
  status: string
  quality_score: number | null
  trend_title?: string | null
  generated_at: string | null
}

interface DashboardData {
  new_trends: number
  high_potential: number
  generated_posts: number
  pending_review: number
  published: number
  queue_count: number
  recent_items_7d: number
  failed_jobs_24h: number
  today_post: TodayPost | null
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
  help: string
}> = [
  {
    key: 'new_trends',
    label: 'New trends',
    help: 'Trends discovered in the current collection window.',
  },
  {
    key: 'high_potential',
    label: 'High potential',
    help: 'Active trends scoring 75 or higher — your best posting candidates.',
  },
  {
    key: 'generated_posts',
    label: 'Generated posts',
    help: 'Every draft, variant and published post in the workspace.',
  },
  {
    key: 'pending_review',
    label: 'Pending review',
    help: 'Posts in Review or Ready state waiting on your decision.',
  },
  {
    key: 'published',
    label: 'Published',
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

  const copyForLinkedIn = useCallback(async (post: TodayPost) => {
    const tags = (post.hashtags ?? []).map((t) => `#${t}`).join(' ')
    const full = [post.hook?.trim(), post.body.trim()].filter(Boolean).join('\n\n')
    const text = `${full}${tags ? `\n\n${tags}` : ''}`

    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied — paste it into LinkedIn.')
    } catch {
      toast.error('Clipboard blocked by the browser. Copy from the Studio preview instead.')
    }
  }, [])

  return (
    <div className="mx-auto max-w-[1200px] space-y-10 px-4 py-8 sm:px-6">
      <PageHeader
        title="Overview"
        description="Software engineering trends worth posting about — refreshed continuously."
      />

      {data && data.failed_jobs_24h > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <WarningIcon className="size-4 shrink-0" />
          <span>
            {data.failed_jobs_24h} pipeline job{data.failed_jobs_24h === 1 ? '' : 's'} failed in the
            last 24 hours.
          </span>
          <Button asChild variant="outline" size="xs" className="ml-auto">
            <Link to="/jobs">Open Jobs</Link>
          </Button>
        </div>
      ) : null}

      {data?.today_post ? (
        <section className="space-y-4">
          <SectionHeader
            title="Today's post"
            help={
              <HelpTip text="Generated overnight by posts:nightly from the most useful trend. Copy it straight into LinkedIn — hashtags included." />
            }
            actions={
              <Button
                variant="outline"
                size="xs"
                onClick={() => data.today_post && copyForLinkedIn(data.today_post)}
              >
                <ClipboardIcon className="size-3.5" />
                Copy for LinkedIn
              </Button>
            }
          />
          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={data.today_post.status} />
                <span className="font-mono">{contentFormatLabel(data.today_post.format)}</span>
                <span aria-hidden>·</span>
                <span className="font-mono tabular-nums">
                  quality {Math.round(data.today_post.quality_score ?? 0)}
                </span>
                {data.today_post.generated_at ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>from {new Date(data.today_post.generated_at).toLocaleString()}</span>
                  </>
                ) : null}
              </div>
              <p className="max-w-3xl font-serif text-xl leading-snug font-medium tracking-tight">
                {data.today_post.hook || data.today_post.title}
              </p>
              <p className="line-clamp-5 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {data.today_post.body}
              </p>
              {data.today_post.hashtags.length > 0 ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {data.today_post.hashtags.map((tag) => (
                    <span key={tag} className="font-mono text-xs text-muted-foreground">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => data.today_post && copyForLinkedIn(data.today_post)}>
                  <ClipboardIcon className="size-3.5" />
                  Copy post
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/studio/${data.today_post.id}`}>Open in Studio</Link>
                </Button>
              </div>
              {data.today_post.trend_title ? (
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Trend: {data.today_post.trend_title}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section
        aria-label="Workspace metrics"
        className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5"
      >
        {STATS.map(({ key, label, help }) => (
          <StatTile
            key={key}
            label={label}
            help={help}
            value={data ? (data[key] as number) : null}
          />
        ))}
      </section>

      <section className="space-y-4">
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
            icon={LightningIcon}
            title="No recommendations yet"
            description="Run a collection to populate this list."
          />
        ) : (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {data.recommended.map((trend) => (
                <div key={trend.id} className="flex items-center gap-4 px-4 py-3">
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
                    <SparkleIcon className="size-3.5" />
                    Generate
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
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
          <Skeleton className="h-40 rounded-lg" />
        ) : data.trending_now.length === 0 ? (
          <EmptyState
            icon={TrendUpIcon}
            title="No scored trends yet"
            description="Collectors are still warming up."
          />
        ) : (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {data.trending_now.map((trend, index) => (
                <button
                  key={trend.id}
                  type="button"
                  onClick={() => navigate('/trends')}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-muted"
                >
                  <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{trend.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {trend.category?.name ?? 'Uncategorized'} · {trend.item_count} signal
                      {trend.item_count === 1 ? '' : 's'} · novelty{' '}
                      {Math.round(trend.scores.novelty)}
                    </span>
                  </span>
                  <ScorePill score={trend.scores.trend} />
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
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
            icon={ClipboardTextIcon}
            title="Nothing waiting"
            description="Posts routed to Review or Ready will appear here."
          />
        ) : (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {data.recent_content
                .filter((p) => ['review', 'ready'].includes(p.status))
                .slice(0, 5)
                .map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => navigate(`/studio/${post.id}`)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-muted"
                  >
                    <StatusBadge status={post.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {(post.hook ?? post.title) || '(untitled)'}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {contentFormatLabel(post.format)}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      Quality {post.quality_score !== null ? Math.round(post.quality_score) : '—'}
                    </span>
                  </button>
                ))}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
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
            icon={ClipboardTextIcon}
            title="No posts yet"
            description="Pick a recommended topic above to generate your first post."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  <span>{post.updated_at ? new Date(post.updated_at).toLocaleDateString() : '—'}</span>
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
