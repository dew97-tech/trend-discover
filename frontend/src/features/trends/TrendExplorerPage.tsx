import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Radar, RefreshCw, Sparkles, Target, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { fetchTrends, fetchTaxonomy, fetchTrend, rescoreTrend, deleteTrend, type Taxonomy, type TrendDetail } from './api'
import { FormatPickerDialog } from './FormatPickerDialog'
import type { Trend } from './types'
import { SCORE_HELP as TREND_SCORE_HELP } from '@/lib/scores'
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
  const [trends, setTrends] = useState<Trend[]>([])
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [technologyId, setTechnologyId] = useState<string | null>(null)
  const [focusOnly, setFocusOnly] = useState(false)
  const [minScore, setMinScore] = useState('0')
  const [dateRange, setDateRange] = useState('14')

  const [selected, setSelected] = useState<TrendDetail | null>(null)
  const [rescoring, setRescoring] = useState(false)
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

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      category_id: categoryId !== 'all' ? categoryId : undefined,
      technology_id: technologyId ?? undefined,
      focus: focusOnly ? '1' : undefined,
      min_trend_score: minScore !== '0' ? minScore : undefined,
      from:
        dateRange !== 'all'
          ? new Date(Date.now() - Number(dateRange) * 86_400_000).toISOString()
          : undefined,
    }),
    [debouncedSearch, categoryId, technologyId, focusOnly, minScore, dateRange],
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
        toast.success('Trend deleted — its source items are free to re-cluster.')
        setConfirmDelete(false)
        setSelected(null)
        load()
      })
      .catch((err: Error) => toast.error(err.message || 'Delete failed.'))
      .finally(() => setDeleting(false))
  }

  function handleRescore() {
    if (!selected) return
    setRescoring(true)

    rescoreTrend(selected.id)
      .then(() =>
        toast.success('Re-score queued — watch it run in Pipeline Jobs.', {
          action: {
            label: 'View',
            onClick: () => window.open('/jobs', '_self'),
          },
        }),
      )
      .catch(() => toast.error('Re-score failed.'))
      .finally(() => setRescoring(false))
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Trends"
        description="Clustered stories across every source, ranked by configurable scoring."
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trends…"
            className="pl-9"
          />
        </div>

        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-48">
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
          <SelectTrigger className="w-40">
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
          <SelectTrigger className="w-40">
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={focusOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFocusOnly((v) => !v)}
          title="Only show trends matching your focus topics (Laravel, PHP/TS, React, Next.js, databases)"
        >
          <Target className="size-3.5" />
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
        <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : trends.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No trends match these filters"
          description="Try widening the date range, clearing the focus toggle, or lowering the minimum score."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {trends.map((trend) => (
              <Card
                key={trend.id}
                onClick={() => openDetail(trend)}
                className="cursor-pointer transition-colors hover:border-primary/40"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {trend.category?.name ?? 'Uncategorized'}
                      </span>
                      {trend.hack_style ? (
                        <Badge variant="outline" className="gap-1 text-[10px] text-primary">
                          <Wrench className="size-3" />
                          hack
                        </Badge>
                      ) : null}
                    </div>
                    <ScorePill score={trend.scores.trend} />
                  </div>
                  <p className="line-clamp-2 pt-1 text-sm font-medium leading-snug">
                    {trend.title}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {trend.technologies && trend.technologies.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {trend.technologies.slice(0, 4).map((tech) => (
                        <Badge key={tech.id} variant="outline" className="px-1.5 py-0 text-[10px]">
                          {tech.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {trend.item_count} signal{trend.item_count === 1 ? '' : 's'}
                    </span>
                    <span>novelty {Math.round(trend.scores.novelty)}</span>
                    <span>sat {Math.round(trend.scores.saturation)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {nextCursor ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <RefreshCw className="size-4 animate-spin" /> : null}
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
                  {selected.category?.name ?? 'Uncategorized'} · {selected.item_count} signal
                  {selected.item_count === 1 ? '' : 's'}
                  {selected.hack_style ? ' · hack-style' : ''} · first seen{' '}
                  {selected.first_seen_at
                    ? new Date(selected.first_seen_at).toLocaleDateString()
                    : '—'}
                </DialogDescription>
              </DialogHeader>

              {/* Scrollable body — header + actions stay pinned */}
              <div className="-mx-1 flex-1 space-y-5 overflow-y-auto px-1">
                {selected.summary ? (
                  <p className="text-sm leading-relaxed [overflow-wrap:anywhere] text-muted-foreground">
                    {selected.summary}
                  </p>
                ) : null}

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Score breakdown</h3>
                  {(
                    [
                      ['Freshness', selected.scores.freshness, 'freshness'],
                      ['Momentum', selected.scores.momentum, 'momentum'],
                      ['Relevance', selected.scores.relevance, 'relevance'],
                      ['Usefulness', selected.scores.usefulness, 'usefulness'],
                      ['Focus', selected.scores.focus ?? 0, 'focus'],
                      ['Novelty', selected.scores.novelty, 'novelty'],
                      ['Saturation', selected.scores.saturation, 'saturation'],
                    ] as const
                  ).map(([label, value, key]) => (
                    <div key={label} className="flex min-w-0 items-center gap-3">
                      <span className="flex w-24 shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        {label}
                        <HelpTip text={TREND_SCORE_HELP[key]} />
                      </span>
                      <Progress value={value} className="h-2 min-w-0 flex-1" />
                      <span className="w-9 shrink-0 text-right text-xs tabular-nums">
                        {Math.round(value)}
                      </span>
                    </div>
                  ))}
                </section>

                {selected.sources.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Detected signals</h3>
                    <ul className="space-y-1.5">
                      {selected.sources.slice(0, 8).map((source, i) => (
                        <li key={i} className="flex min-w-0 items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center truncate text-muted-foreground">
                            <Badge variant="outline" className="mr-1.5 shrink-0 px-1 py-0 text-[10px]">
                              {source.source ?? '?'}
                            </Badge>
                            <span
                              className="cursor-help truncate [overflow-wrap:anywhere]"
                              title={source.url ?? source.title ?? undefined}
                            >
                              {source.title ?? '(untitled)'}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
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

              <div className="flex shrink-0 items-center justify-between gap-2 border-t pt-3">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-danger disabled:opacity-50"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete trend
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleRescore} disabled={rescoring}>
                    <RefreshCw className={cn('size-3.5', rescoring && 'animate-spin')} />
                    Re-score
                  </Button>
                  <Button size="sm" onClick={() => setPickerOpen(true)}>
                    <Sparkles className="size-3.5" />
                    Generate post
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center p-8">
              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this trend?"
        description={
          <>
            It disappears from all lists. Its {selected?.item_count ?? 0} source items are freed
            for future clustering, and generated posts stay in the Studio.
          </>
        }
        confirmLabel="Delete trend"
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
