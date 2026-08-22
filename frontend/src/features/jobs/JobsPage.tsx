import { useCallback, useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

interface JobRun {
  id: number
  job_class: string
  status: string
  attempts: number
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  error?: string
  meta?: Record<string, unknown> | null
}

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-success-soft text-success',
  running: 'bg-info-soft text-info',
  failed: 'bg-danger-soft text-danger',
  queued: 'bg-surface-muted text-muted-foreground',
}

const TABS = ['all', 'success', 'failed', 'running'] as const

export function JobsPage() {
  const [runs, setRuns] = useState<JobRun[] | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [logLines, setLogLines] = useState<string[] | null>(null)

  const load = useCallback(() => {
    api<{ data: JobRun[] }>('/jobs')
      .then(({ data }) => setRuns(data))
      .catch(() => toast.error('Failed to load job runs.'))
  }, [])

  function toggleRow(run: JobRun) {
    if (expanded === run.id) {
      setExpanded(null)
      return
    }

    setExpanded(run.id)
    setLogLines(null)

    api<{ data: { lines: string[] } }>(`/jobs/${run.id}/log`)
      .then(({ data }) => setLogLines(data.lines))
      .catch(() => {
        setLogLines([])
        toast.error('Could not read the pipeline log for this run.')
      })
  }

  useEffect(() => {
    load()

    if (!autoRefresh) return

    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load, autoRefresh])

  const filtered = runs?.filter((run) =>
    tab === 'all' ? true : run.status === tab,
  ) ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Activity className="size-6 text-primary" />
          Pipeline Jobs
        </h1>
        <p className="text-sm text-muted-foreground">
          Collection, detection, scoring and generation runs — with durations and failures.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            auto-refresh 5s
          </label>
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {!runs ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No {tab === 'all' ? '' : tab + ' '}job runs yet.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Job</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Duration</th>
                  <th className="px-4 py-2.5 font-medium">Started</th>
                  <th className="px-4 py-2.5 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((run) => (
                  <>
                    <tr
                      key={run.id}
                      onClick={() => toggleRow(run)}
                      className="cursor-pointer border-b align-top hover:bg-surface-muted/60"
                    >
                      <td className="px-4 py-2.5">
                        <span className="mr-1.5 inline-flex w-3 align-middle text-muted-foreground">
                          {expanded === run.id ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </span>
                        <span className="font-mono text-xs">
                          {run.job_class.replace(/^App\\Jobs\\/, '')}
                        </span>
                        {run.attempts > 1 ? (
                          <Badge variant="outline" className="ml-2 px-1 py-0 text-[10px]">
                            attempt {run.attempts}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[run.status] ?? ''}`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-xs">
                        {formatDuration(run.duration_ms)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {run.started_at
                          ? new Date(run.started_at).toLocaleTimeString()
                          : '—'}
                      </td>
                      <td className="max-w-md px-4 py-2.5 text-xs">
                        {run.status === 'failed' && run.error ? (
                          <span className="line-clamp-2 text-danger" title={run.error}>
                            {run.error}
                          </span>
                        ) : run.meta ? (
                          <MetaSummary meta={run.meta} />
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                    {expanded === run.id ? (
                      <tr key={`${run.id}-log`} className="border-b last:border-0 bg-surface-muted/40">
                        <td colSpan={5} className="px-6 py-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Pipeline log — run #{run.id}
                          </p>
                          {logLines === null ? (
                            <p className="text-xs italic text-muted-foreground">Reading log…</p>
                          ) : logLines.length === 0 ? (
                            <p className="text-xs italic text-muted-foreground">
                              No structured events recorded for this run.
                            </p>
                          ) : (
                            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-2.5 font-mono text-[11px] leading-relaxed">
                              {logLines.join('\n')}
                            </pre>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms >= 60_000) return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

function MetaSummary({ meta }: { meta: Record<string, unknown> }) {
  const interesting = [
    meta.fetched !== undefined ? `fetched ${meta.fetched}` : null,
    meta.inserted !== undefined ? `inserted ${meta.inserted}` : null,
    meta.duplicates_skipped !== undefined ? `dupes ${meta.duplicates_skipped}` : null,
    meta.trends_touched !== undefined ? `trends ${meta.trends_touched}` : null,
    meta.post_id !== undefined ? `post #${meta.post_id}` : null,
    meta.quality !== undefined ? `quality ${Math.round(Number(meta.quality))}` : null,
    meta.routed_to ?? null,
  ].filter(Boolean)

  return <span className="text-muted-foreground">{interesting.join(' · ') || '—'}</span>
}
