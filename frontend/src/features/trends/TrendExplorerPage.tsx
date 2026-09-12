import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Radar, RefreshCw, X, Sparkles, Loader2, Target, Wrench } from 'lucide-react'
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
import { fetchTrends, fetchTaxonomy, fetchTrend, rescoreTrend, deleteTrend, type Taxonomy, type TrendDetail } from './api'
import { FormatPickerDialog } from './FormatPickerDialog'
import { scoreTier, type Trend } from './types'
import { cn } from '@/lib/utils'

const DATE_RANGES = [
  { value: 'all', label: 'All time' },
  { value: '1', label: 'Last 24 hours' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
] as const

const SCORE_TIERS = {
  high: 'bg-success-soft text-success',
  medium: 'bg-warning-soft text-warning',
  low: 'bg-surface-muted text-muted-foreground',
} as const

const SCORE_HELP: Record<string, string> = {
  Freshness: 'How recently this story surfaced — decays over ~1.5 days per halving.',
  Momentum: 'Engagement speed (points/comments per hour since first seen).',
  Relevance: 'Match strength against your technology & category registry.',
  Usefulness: 'Practical engineering value — hack/tip phrasing gets a boost.',
  Focus: 'How well this matches your focus topics (Laravel, PHP/TS, React, Next.js, databases). Soft boost only.',
  Novelty: 'How fresh and under-covered the story is. High = not everywhere yet.',
  Saturation: 'How much this topic is already being discussed across sources.',
}

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
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Radar className="size-6 text-primary" />
          Trend Explorer
        </h1>
        <p className="text-sm text-muted-foreground">
          Clustered stories across all sources, ranked by configurable scoring.
        </p>
      </header>

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
        <div className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : trends.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No trends match these filters.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {trends.map((trend) => {
              const tier = scoreTier(trend.scores.trend)

              return (
                <Card
                  key={trend.id}
                  onClick={() => openDetail(trend)}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        {trend.category ? (
                          <Badge variant="secondary" className="text-xs">
                            {trend.category.name}
                          </Badge>
                        ) : null}
                        {trend.hack_style ? (
                          <Badge variant="outline" className="gap-1 px-1.5 text-[10px] text-primary">
                            <Wrench className="size-3" />
                            hack
                          </Badge>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                          SCORE_TIERS[tier],
                        )}
                      >
                        {Math.round(trend.scores.trend)}
                      </span>
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
                      <span>{trend.item_count} signal{trend.item_count === 1 ? '' : 's'}</span>
                      <span>novelty {Math.round(trend.scores.novelty)}</span>
                      <span>sat {Math.round(trend.scores.saturation)}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
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
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
                      SCORE_TIERS[scoreTier(selected.scores.trend)],
                    )}
                    title="Composite trend score"
                  >
                    {Math.round(selected.scores.trend)}
                  </span>
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
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Score breakdown
                  </h3>
                  {Object.entries({
                    Freshness: selected.scores.freshness,
                    Momentum: selected.scores.momentum,
                    Relevance: selected.scores.relevance,
                    Usefulness: selected.scores.usefulness,
                    Focus: selected.scores.focus ?? 0,
                    Novelty: selected.scores.novelty,
                    Saturation: selected.scores.saturation,
                  }).map(([label, value]) => (
                    <div key={label} className="flex min-w-0 items-center gap-3">
                      <span
                        className="w-24 shrink-0 cursor-help text-xs text-muted-foreground underline decoration-dotted decoration-border underline-offset-2"
                        title={SCORE_HELP[label]}
                      >
                        {label}
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
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Detected signals
                    </h3>
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
                    Generate Post
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center p-8">
              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
              <X className="hidden" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(false)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-left text-base">Delete this trend?</DialogTitle>
            <DialogDescription className="text-left">
              It will disappear from all lists. Its {selected?.item_count ?? 0} source items are
              freed for future clustering, and the trend can be restored via API if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete trend
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FormatPickerDialog
        trendId={selected?.id ?? 0}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </div>
  )
}
