import { useEffect, useMemo, useState } from 'react'
import { Search, Radar, RefreshCw, X } from 'lucide-react'
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
import { fetchTrends, fetchTaxonomy, fetchTrend, rescoreTrend, type Taxonomy, type TrendDetail } from './api'
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
  const [minScore, setMinScore] = useState('0')
  const [dateRange, setDateRange] = useState('14')

  const [selected, setSelected] = useState<TrendDetail | null>(null)
  const [rescoring, setRescoring] = useState(false)

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
      min_trend_score: minScore !== '0' ? minScore : undefined,
      from:
        dateRange !== 'all'
          ? new Date(Date.now() - Number(dateRange) * 86_400_000).toISOString()
          : undefined,
    }),
    [debouncedSearch, categoryId, minScore, dateRange],
  )

  useEffect(() => {
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
    fetchTrend(trend.id).then(setSelected).catch(() => toast.error('Could not load trend details.'))
  }

  function handleRescore() {
    if (!selected) return
    setRescoring(true)

    rescoreTrend(selected.id)
      .then(() => toast.success('Re-score queued — refresh in a few seconds.'))
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
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <DialogTitle className="text-left text-base leading-snug">
                    {selected.title}
                  </DialogTitle>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
                      SCORE_TIERS[scoreTier(selected.scores.trend)],
                    )}
                  >
                    {Math.round(selected.scores.trend)}
                  </span>
                </div>
                <DialogDescription className="text-left">
                  {selected.category?.name ?? 'Uncategorized'} · {selected.item_count} signals ·
                  first seen{' '}
                  {selected.first_seen_at
                    ? new Date(selected.first_seen_at).toLocaleDateString()
                    : '—'}
                </DialogDescription>
              </DialogHeader>

              {selected.summary ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{selected.summary}</p>
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
                  Novelty: selected.scores.novelty,
                  Saturation: selected.scores.saturation,
                }).map(([label, value]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
                    <Progress value={value} className="h-2 flex-1" />
                    <span className="w-9 text-right text-xs tabular-nums">{Math.round(value)}</span>
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
                      <li key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-muted-foreground">
                          <Badge variant="outline" className="mr-1.5 px-1 py-0 text-[10px]">
                            {source.source ?? '?'}
                          </Badge>
                          {source.title ?? '(untitled)'}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {source.metrics.points ?? source.metrics.stars ?? source.metrics.score ?? source.metrics.reactions ?? '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleRescore} disabled={rescoring}>
                  <RefreshCw className={cn('size-3.5', rescoring && 'animate-spin')} />
                  Re-score
                </Button>
                <Button size="sm" disabled title="Arrives in Phase 5">
                  Generate Post
                </Button>
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
    </div>
  )
}
