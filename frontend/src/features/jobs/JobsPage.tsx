import { useCallback, useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronRight, Loader2, Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodeBlock } from '@/components/shared/CodeBlock'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Toolbar } from '@/components/shared/Toolbar'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { runDetection } from '../trends/api'

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

/** Worker classes read as product verbs, not PHP class names. */
const JOB_LABELS: Record<string, string> = {
  CollectSourceItemsJob: 'Fetch source',
  DetectTrendsJob: 'Find trends',
  CalculateTrendScoreJob: 'Score trend',
  GeneratePostJob: 'Generate post',
  SuggestSnippetJob: 'Suggest snippet',
  GenerateImagePromptJob: 'Generate image prompt',
  GenerateHashtagsJob: 'Generate hashtags',
}

const JOB_STATUS: Record<string, { label: string; className: string }> = {
  success: { label: 'Succeeded', className: 'bg-success-soft text-success' },
  running: { label: 'Running', className: 'bg-info-soft text-info' },
  failed: { label: 'Failed', className: 'bg-danger-soft text-danger' },
  queued: { label: 'Queued', className: 'bg-surface-muted text-muted-foreground' },
}

const TABS = ['all', 'success', 'failed', 'running'] as const

function jobLabel(jobClass: string): string {
  const base = jobClass.replace(/^App\\Jobs\\/, '')

  return JOB_LABELS[base] ?? base
}

export function JobsPage() {
  const [runs, setRuns] = useState<JobRun[] | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [logLines, setLogLines] = useState<string[] | null>(null)
  const [detecting, setDetecting] = useState(false)

  const load = useCallback(() => {
    api<{ data: JobRun[] }>('/jobs')
      .then(({ data }) => setRuns(data))
      .catch(() => toast.error('Failed to load job runs.'))
  }, [])

  useEffect(() => {
    load()

    if (!autoRefresh) return

    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load, autoRefresh])

  function handleRunDetection() {
    setDetecting(true)

    runDetection()
      .then(() => {
        toast.success('Trend search queued — new runs will appear below.')
        setTimeout(load, 1500)
      })
      .catch(() => toast.error('Could not queue the trend search.'))
      .finally(() => setDetecting(false))
  }

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

  const filtered = runs?.filter((run) => (tab === 'all' ? true : run.status === tab)) ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        title="Automation"
        description="Every background run — fetching, finding trends, scoring and generating — with durations, failures and logs."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Auto-refresh
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} className="scale-75" />
            </label>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleRunDetection}
              disabled={detecting}
              title="Groups new mentions into trends and scores them"
            >
              {detecting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              Find new trends
            </Button>
          </>
        }
      />

      <Toolbar>
        <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Toolbar>

      {!runs ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={`No ${tab === 'all' ? '' : `${tab} `}runs`}
          description="Runs appear here as fetching, trend finding, scoring and generation execute."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Run</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Duration</th>
                  <th className="px-4 py-2.5 font-medium">Started</th>
                  <th className="px-4 py-2.5 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((run) => {
                  const status = JOB_STATUS[run.status] ?? {
                    label: run.status,
                    className: 'bg-surface-muted text-muted-foreground',
                  }

                  return (
                    <JobRow
                      key={run.id}
                      run={run}
                      status={status}
                      expanded={expanded === run.id}
                      logLines={logLines}
                      onToggle={() => toggleRow(run)}
                    />
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface JobRowProps {
  run: JobRun
  status: { label: string; className: string }
  expanded: boolean
  logLines: string[] | null
  onToggle: () => void
}

function JobRow({ run, status, expanded, logLines, onToggle }: JobRowProps) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b align-top transition-colors hover:bg-surface-muted/60"
      >
        <td className="px-4 py-2.5">
          <span className="mr-1.5 inline-flex w-3 align-middle text-muted-foreground">
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </span>
          <span className="text-xs font-medium">{jobLabel(run.job_class)}</span>
          {run.attempts > 1 ? (
            <Badge variant="outline" className="ml-2 px-1 py-0 text-[10px]">
              attempt {run.attempts}
            </Badge>
          ) : null}
        </td>
        <td className="px-4 py-2.5">
          <span
            className={cn(
              'whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium',
              status.className,
            )}
          >
            {status.label}
          </span>
        </td>
        <td className="px-4 py-2.5 text-xs tabular-nums">{formatDuration(run.duration_ms)}</td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground">
          {run.started_at ? new Date(run.started_at).toLocaleTimeString() : '—'}
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
      {expanded ? (
        <tr className="border-b bg-surface-muted/40 last:border-0">
          <td colSpan={5} className="px-6 py-3">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
              Run log — #{run.id}
            </p>
            {logLines === null ? (
              <p className="text-xs italic text-muted-foreground">Reading log…</p>
            ) : logLines.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                No structured events recorded for this run.
              </p>
            ) : (
              <CodeBlock
                code={logLines.join('\n')}
                maxHeightClass="max-h-56"
                className="bg-background"
              />
            )}
          </td>
        </tr>
      ) : null}
    </>
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
    meta.count !== undefined ? `tags ${meta.count}` : null,
    meta.routed_to ?? null,
  ].filter(Boolean)

  return <span className="text-muted-foreground">{interesting.join(' · ') || '—'}</span>
}
