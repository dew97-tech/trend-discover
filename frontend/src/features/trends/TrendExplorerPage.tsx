import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowsClockwiseIcon,
  CircleNotchIcon,
  CrosshairIcon,
  MagnifyingGlassIcon,
  SparkleIcon,
  TargetIcon,
  WrenchIcon,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { HelpTip } from '@/components/shared/HelpTip'
import { PageHeader } from '@/components/shared/PageHeader'
import { ScorePill } from '@/components/shared/ScorePill'
import { fetchTrends, fetchTaxonomy, fetchTrend, rescoreTrend, deleteTrend, updateTrendWorkflowStatus, type Taxonomy, type TrendDetail } from './api'
import { FormatPickerDialog } from './FormatPickerDialog'
import type { Trend } from './types'
import { SCORE_HELP as TREND_SCORE_HELP, SCORE_LABELS } from '@/lib/scores'
import { TREND_WORKFLOW_STATUS_KEYS, trendWorkflowMeta } from '@/lib/labels'
import { cn } from '@/lib/utils'

const DATE_RANGES = [
  { value: 'all', label: 'All time' },
  { value: '1', label: 'Last 24 hours' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
] as const

// Quick topic chips map to the existing technology_id filter.
const FOCUS_CHIPS = [
  { slug: 'laravel', label: 'Laravel' },
  { slug: 'mysql', label: 'MySQL' },
  { slug: 'react', label: 'React' },
  { slug: 'next-js', label: 'Next.js' },
  { slug: 'php', label: 'PHP' },
  { slug: 'typescript', label: 'TypeScript' },
]

export function TrendExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [trends, setTrends] = useState<Trend[]>([])
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') ?? '')
  const [categoryId, setCategoryId] = useState(() => searchParams.get('category') ?? 'all')
  const [technologyId, setTechnologyId] = useState<string | null>(() => searchParams.get('tech'))
  const [focusOnly, setFocusOnly] = useState(() => searchParams.get('focus') === '1')
  const [minScore, setMinScore] = useState(() => searchParams.get('min') ?? '0')
  const [dateRange, setDateRange] = useState(() => searchParams.get('range') ?? '14')
  const [workflowStatus, setWorkflowStatus] = useState(() => searchParams.get('status') ?? 'all')

  const [selected, setSelected] = useState<TrendDetail | null>(null)
  const [rescoring, setRescoring] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetchTaxonomy().then(setTaxonomy).catch(() => null)
  }, [])

  // Keep the filtered view linkable — every filter lives in the URL.
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (categoryId !== 'all') params.set('category', categoryId)
    if (technologyId) params.set('tech', technologyId)
    if (focusOnly) params.set('focus', '1')
    if (minScore !== '0') params.set('min', minScore)
    if (dateRange !== '14') params.set('range', dateRange)
    if (workflowStatus !== 'all') params.set('status', workflowStatus)
    setSearchParams(params, { replace: true })
  }, [
    debouncedSearch,
    categoryId,
    technologyId,
    focusOnly,
    minScore,
    dateRange,
    workflowStatus,
    setSearchParams,
  ])

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      category_id: categoryId !== 'all' ? categoryId : undefined,
      technology_id: technologyId ?? undefined,
      focus: focusOnly ? '1' : undefined,
      workflow_status: workflowStatus !== 'all' ? workflowStatus : undefined,
      min_trend_score: minScore !== '0' ? minScore : undefined,
      from:
        dateRange !== 'all'
          ? new Date(Date.now() - Number(dateRange) * 86_400_000).toISOString()
          : undefined,
    }),
    [debouncedSearch, categoryId, technologyId, focusOnly, workflowStatus, minScore, dateRange],
  )

  const load = useCallback(() => {
    setLoading(true)
    setSelected(null)

    fetchTrends(filters)
      .then((res) => {
        setTrends(res.data)
        setNextCursor(res.next_cursor)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load trends'))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)

    fetchTrends(filters, nextCursor)
      .then((res) => {
        setTrends((prev) => [...prev, ...res.data])
        setNextCursor(res.next_cursor)
      })
      .catch(() => toast.error('Could not load more trends.'))
      .finally(() => setLoadingMore(false))
  }

  function openDetail(trend: Trend) {
    setSelected(null)
    fetchTrend(trend.id)
      .then(setSelected)
      .catch(() => toast.error('Could not load trend details.'))
  }

  function handleDelete() {
    if (!selected) return
    setDeleting(true)

    deleteTrend(selected.id)
      .then(() => {
        toast.success('Trend removed — its mentions can group into fresh trends.')
        setConfirmDelete(false)
        setSelected(null)
        load()
      })
      .catch((err: Error) => toast.error(err.message || 'Remove failed.'))
      .finally(() => setDeleting(false))
  }

  function handleRescore() {
    if (!selected) return
    setRescoring(true)

    rescoreTrend(selected.id)
      .then(() =>
        toast.success('Score refresh queued — watch it run in Automation.', {
          action: {
            label: 'View',
            onClick: () => window.open('/jobs', '_self'),
          },
        }),
      )
      .catch(() => toast.error('Score refresh failed.'))
      .finally(() => setRescoring(false))
  }

  function handleWorkflowStatus(status: 'draft' | 'ready' | 'posted') {
    if (!selected) return
    setSavingStatus(true)

    updateTrendWorkflowStatus(selected.id, status)
      .then((res) => {
        setSelected((prev) => (prev ? { ...prev, workflow_status: res.data.workflow_status } : prev))
        setTrends((prev) =>
          prev.map((t) => (t.id === selected.id ? { ...t, workflow_status: res.data.workflow_status } : t)),
        )
        toast.success(`Trend marked as ${trendWorkflowMeta(status).label}.`)
      })
      .catch(() => toast.error('Could not update the trend status.'))
      .finally(() => setSavingStatus(false))
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Trends"
        description="Stories grouped across all sources, ranked by your scoring setup."
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <ArrowsClockwiseIcon className={cn('size-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trends…"
            aria-label="Search trends"
            spellCheck={false}
            className="pl-9"
          />
        </div>

        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-48" aria-label="Category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {taxonomy?.categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={minScore} onValueChange={setMinScore}>
          <SelectTrigger className="w-40" aria-label="Minimum score">
            <SelectValue placeholder="Min score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any score</SelectItem>
            <SelectItem value="55">55+</SelectItem>
            <SelectItem value="70">70+</SelectItem>
            <SelectItem value="75">75+ (high)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40" aria-label="Date range">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={workflowStatus} onValueChange={setWorkflowStatus}>
          <SelectTrigger className="w-36" aria-label="Workflow status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {TREND_WORKFLOW_STATUS_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {trendWorkflowMeta(key).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={focusOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFocusOnly((v) => !v)}
          title="Only show trends matching your focus topics (Laravel, PHP/TS, React, Next.js, databases)"
        >
          <TargetIcon className="size-3.5" />
          Focus topics
        </Button>
        {FOCUS_CHIPS.map((chip) => {
          const tech = taxonomy?.technologies.find((t) => t.slug === chip.slug)
          if (!tech) return null
          const active = technologyId === String(tech.id)

          return (
            <Button
              key={chip.slug}
              variant={active ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setTechnologyId(active ? null : String(tech.id))}
            >
              {chip.label}
            </Button>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : trends.length === 0 ? (
        <EmptyState
          icon={CrosshairIcon}
          title="No trends match these filters"
          description="Try widening the date range, clearing the focus toggle, or lowering the minimum score."
        />
      ) : (
        <>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {trends.map((trend) => {
                const workflow = trendWorkflowMeta(trend.workflow_status)

                return (
                  <button
                    key={trend.id}
                    type="button"
                    onClick={() => openDetail(trend)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
                  >
                    <ScorePill score={trend.scores.trend} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{trend.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {trend.category?.name ?? 'General'}
                        {trend.technologies && trend.technologies.length > 0
                          ? ` · ${trend.technologies
                              .slice(0, 4)
                              .map((tech) => tech.name)
                              .join(' · ')}`
                          : ''}
                        {' · '}
                        {trend.item_count} mention{trend.item_count === 1 ? '' : 's'}
                      </span>
                    </span>
                    {trend.hack_style ? (
                      <span className="hidden shrink-0 items-center gap-1 font-mono text-[10px] tracking-[0.08em] text-signal uppercase sm:flex">
                        <WrenchIcon className="size-3" />
                        tip
                      </span>
                    ) : null}
                    <span className="hidden shrink-0 font-mono text-xs tabular-nums text-muted-foreground lg:block">
                      novelty {Math.round(trend.scores.novelty)}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase',
                        workflow.className,
                      )}
                    >
                      {workflow.label}
                    </span>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {nextCursor ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader className="shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <DialogTitle className="min-w-0 text-left text-base leading-snug [overflow-wrap:anywhere]">
                    {selected.title}
                  </DialogTitle>
                  <ScorePill score={selected.scores.trend} className="px-2.5 py-1 text-sm" />
                </div>
                <DialogDescription className="text-left">
                  {selected.category?.name ?? 'General'} · {selected.item_count} mention
                  {selected.item_count === 1 ? '' : 's'}
                  {selected.hack_style ? ' · practical tip' : ''} · first seen{' '}
                  {selected.first_seen_at
                    ? new Date(selected.first_seen_at).toLocaleDateString()
                    : '—'}
                </DialogDescription>
              </DialogHeader>

              {/* Manual workflow state — never touched by automation */}
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border pb-3">
                <span className="mr-1 text-xs text-muted-foreground">Status</span>
                {TREND_WORKFLOW_STATUS_KEYS.map((key) => {
                  const meta = trendWorkflowMeta(key)
                  const active = selected.workflow_status === key

                  return (
                    <Button
                      key={key}
                      variant={active ? 'default' : 'outline'}
                      size="xs"
                      disabled={savingStatus}
                      title={meta.description}
                      onClick={() => !active && handleWorkflowStatus(key)}
                    >
                      {meta.label}
                    </Button>
                  )
                })}
              </div>

              {/* Scrollable body — header + actions stay pinned */}
              <div className="-mx-1 flex-1 space-y-5 overflow-y-auto overscroll-contain px-1">
                {selected.summary ? (
                  <p className="text-sm leading-relaxed [overflow-wrap:anywhere] text-muted-foreground">
                    {selected.summary}
                  </p>
                ) : null}

                <section className="space-y-2">
                  <h3 className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Score details
                  </h3>
                  {(
                    [
                      ['freshness', selected.scores.freshness],
                      ['momentum', selected.scores.momentum],
                      ['relevance', selected.scores.relevance],
                      ['usefulness', selected.scores.usefulness],
                      ['focus', selected.scores.focus ?? 0],
                      ['novelty', selected.scores.novelty],
                      ['saturation', selected.scores.saturation],
                    ] as const
                  ).map(([key, value]) => (
                    <div key={key} className="flex min-w-0 items-center gap-3">
                      <span className="flex w-28 shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        {SCORE_LABELS[key]}
                        <HelpTip text={TREND_SCORE_HELP[key]} />
                      </span>
                      <Progress value={value} className="min-w-0 flex-1" />
                      <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums">
                        {Math.round(value)}
                      </span>
                    </div>
                  ))}
                </section>

                {selected.sources.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                      Sources covering this
                    </h3>
                    <ul className="space-y-1.5">
                      {selected.sources.slice(0, 8).map((source, i) => (
                        <li key={i} className="flex min-w-0 items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center truncate text-muted-foreground">
                            <Badge variant="outline" className="mr-1.5 shrink-0 px-1 py-0 font-mono text-[10px]">
                              {source.source ?? '?'}
                            </Badge>
                            <span
                              className="cursor-help truncate [overflow-wrap:anywhere]"
                              title={source.url ?? source.title ?? undefined}
                            >
                              {source.title ?? '(untitled)'}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                            {source.metrics.points ??
                              source.metrics.stars ??
                              source.metrics.score ??
                              source.metrics.reactions ??
                              '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  className="text-xs text-muted-foreground transition-colors duration-150 hover:text-danger disabled:opacity-50"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(true)}
                >
                  Remove trend
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleRescore} disabled={rescoring}>
                    <ArrowsClockwiseIcon className={cn('size-3.5', rescoring && 'animate-spin')} />
                    Refresh score
                  </Button>
                  <Button size="sm" onClick={() => setPickerOpen(true)}>
                    <SparkleIcon className="size-3.5" />
                    Generate post
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center p-8">
              <CircleNotchIcon className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Remove this trend?"
        description={
          <>
            It disappears from all lists. Its {selected?.item_count ?? 0} mentions are freed to
            group into fresh trends, and generated posts stay in Post Studio. It can be restored
            from the API if needed.
          </>
        }
        confirmLabel="Remove trend"
        onConfirm={handleDelete}
        loading={deleting}
      />

      <FormatPickerDialog
        trendId={selected?.id ?? 0}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </div>
  )
}
