import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Save, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/EmptyState'
import { HelpTip } from '@/components/shared/HelpTip'
import { PageHeader } from '@/components/shared/PageHeader'
import { api } from '@/lib/api'
import { fetchSources, type SourceRow } from './api'

interface Weights extends Record<string, number> {}

interface ModelOption {
  id: string
  label: string
  reasoning: boolean
  source: 'allowlist' | 'auto'
  on_gateway: boolean
  working: boolean | null
  latency_ms: number | null
}

interface WeightField {
  key: string
  label: string
  help: string
}

const WEIGHT_FIELDS: WeightField[] = [
  {
    key: 'freshness',
    label: 'Freshness',
    help: 'Decays with age — higher weights favor brand-new stories.',
  },
  {
    key: 'momentum',
    label: 'Momentum',
    help: 'Engagement velocity: points and comments per hour since first seen.',
  },
  {
    key: 'technical_relevance',
    label: 'Technical relevance',
    help: 'How strongly the trend matches technologies in your registry.',
  },
  {
    key: 'practical_usefulness',
    label: 'Practical usefulness',
    help: 'Actionable, tip/hack-style content gets a boost here.',
  },
  {
    key: 'novelty',
    label: 'Novelty',
    help: 'Rewards under-covered topics — the core anti-saturation goal.',
  },
  {
    key: 'topic_focus',
    label: 'Topic focus',
    help: 'Soft boost for Laravel, PHP/TypeScript, React, Next.js and database topics. Never hides other trends.',
  },
  {
    key: 'developer_interest',
    label: 'Developer interest',
    help: 'Raw engagement volume across sources.',
  },
  {
    key: 'discussion_potential',
    label: 'Discussion potential',
    help: 'Comment-heavy stories score higher — good debate material.',
  },
  {
    key: 'source_reliability',
    label: 'Source reliability',
    help: 'More distinct sources covering the same story raises confidence.',
  },
]

const LIMIT_FIELDS: Array<{ key: string; label: string; help: string }> = [
  {
    key: 'max_generations_per_trend',
    label: 'Max variants per trend',
    help: 'How many format/tone/angle variants can be generated for one trend before the limit blocks new runs.',
  },
  {
    key: 'max_image_prompts_per_post',
    label: 'Max image prompts per post',
    help: 'Cap on AI image-prompt generations for a single post.',
  },
  {
    key: 'daily_ai_call_budget',
    label: 'Daily AI call budget',
    help: 'Safety ceiling on AI calls per day across research, posts, snippets and prompts.',
  },
]

export function SettingsPage() {
  const [weights, setWeights] = useState<Weights>({})
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [model, setModel] = useState('')
  const [models, setModels] = useState<ModelOption[]>([])
  const [autoDiscover, setAutoDiscover] = useState(true)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sources, setSources] = useState<SourceRow[] | null>(null)
  const [savingWeights, setSavingWeights] = useState(false)
  const [savingLimits, setSavingLimits] = useState(false)

  useEffect(() => {
    api<{ weights: Weights; limits: Record<string, number>; model: string }>('/settings')
      .then((d) => {
        setWeights(d.weights)
        setLimits(d.limits)
        setModel(d.model)
      })
      .catch(() => toast.error('Failed to load settings.'))

    fetchSources().then(setSources).catch(() => null)
  }, [])

  const loadModels = useCallback(() => {
    return api<{
      models: ModelOption[]
      auto_discover: boolean
      last_refreshed_at: string | null
    }>('/settings/models')
      .then((d) => {
        setModels(d.models)
        setAutoDiscover(d.auto_discover)
        setLastRefreshedAt(d.last_refreshed_at)
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    void loadModels()
  }, [loadModels])

  const weightSum = Object.entries(weights)
    .filter(([k]) => !k.includes('saturation'))
    .reduce((sum, [, v]) => sum + Number(v), 0)

  const activeModel = models.find((m) => m.id === model)
  const activeBroken = activeModel
    ? !activeModel.on_gateway || activeModel.working === false
    : false
  const fallbackModels = models.filter((m) => m.source === 'auto')
  const bestWorking = models
    .filter((m) => m.on_gateway && m.working !== false && m.id !== model)
    .sort((a, b) => (a.latency_ms ?? 99_999) - (b.latency_ms ?? 99_999))[0]

  function handleSaveWeights() {
    if (Math.abs(weightSum - 1) > 0.05) {
      toast.error(`Dimension weights must sum to ≈1.00 — currently ${weightSum.toFixed(2)}.`)
      return
    }

    setSavingWeights(true)
    api('/settings', { method: 'PATCH', body: { weights } })
      .then(() => toast.success('Scoring weights saved — applied to future scoring runs.'))
      .catch(() => toast.error('Save failed.'))
      .finally(() => setSavingWeights(false))
  }

  function handleSaveLimits() {
    setSavingLimits(true)
    api('/settings', { method: 'PATCH', body: { limits } })
      .then(() => toast.success('Generation limits saved.'))
      .catch(() => toast.error('Save failed.'))
      .finally(() => setSavingLimits(false))
  }

  function handleModelChange(next: string) {
    setModel(next)
    api('/settings', { method: 'PATCH', body: { model: next } })
      .then(() => toast.success(`AI model switched to ${next} — applies immediately.`))
      .catch(() => toast.error('Model switch failed.'))
  }

  function handleAutoDiscoverToggle(next: boolean) {
    setAutoDiscover(next)

    api('/settings', { method: 'PATCH', body: { auto_discover: next } })
      .then(() => toast.success(next ? 'Auto-discovery enabled.' : 'Auto-discovery disabled.'))
      .catch(() => {
        setAutoDiscover(!next)
        toast.error('Toggle failed.')
      })
  }

  function handleRefreshModels() {
    setRefreshing(true)

    const previous = lastRefreshedAt
    const startedAt = Date.now()

    api('/settings/models/refresh', { method: 'POST' })
      .then(() => {
        toast.info('Probing the gateway roster for cheap/fast candidates…')

        const timer = setInterval(() => {
          api<{ models: ModelOption[]; last_refreshed_at: string | null; auto_discover: boolean }>(
            '/settings/models',
          )
            .then((res) => {
              setModels(res.models)
              setAutoDiscover(res.auto_discover ?? true)

              if (res.last_refreshed_at && res.last_refreshed_at !== previous) {
                clearInterval(timer)
                setLastRefreshedAt(res.last_refreshed_at)
                setRefreshing(false)
                toast.success('Model catalog refreshed.')
              } else if (Date.now() - startedAt > 90_000) {
                clearInterval(timer)
                setRefreshing(false)
                toast.error('Refresh is taking longer than expected — check Jobs.')
              }
            })
            .catch(() => {
              clearInterval(timer)
              setRefreshing(false)
            })
        }, 5000)
      })
      .catch(() => {
        setRefreshing(false)
        toast.error('Could not queue the model refresh.')
      })
  }

  function toggleSource(source: SourceRow) {
    api(`/sources/${source.id}`, {
      method: 'PATCH',
      body: { is_enabled: !source.is_enabled },
    })
      .then(() =>
        setSources(
          (prev) =>
            prev?.map((s) =>
              s.id === source.id ? { ...s, is_enabled: !source.is_enabled } : s,
            ) ?? null,
        ),
      )
      .then(() => toast.success(`${source.name} ${source.is_enabled ? 'disabled' : 'enabled'}.`))
      .catch(() => toast.error('Toggle failed.'))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <PageHeader
        title="Settings"
        description="Runtime configuration — changes apply without redeploying."
      />

      {/* Scoring weights */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              Trend scoring
              <HelpTip text="Dimension weights for the composite trend score. The score is normalized by the sum of weights, so relative values matter more than exact totals." />
            </p>
            <Badge variant={Math.abs(weightSum - 1) <= 0.05 ? 'secondary' : 'destructive'}>
              sum {weightSum.toFixed(2)} / 1.00
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {WEIGHT_FIELDS.map(({ key, label, help }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="flex w-44 shrink-0 items-center gap-1 text-xs">
                {label}
                <HelpTip text={help} />
              </span>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={weights[key] ?? 0}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                className="h-1.5 flex-1 accent-[var(--primary)]"
              />
              <span className="w-10 text-right text-xs tabular-nums">
                {(weights[key] ?? 0).toFixed(2)}
              </span>
            </div>
          ))}

          <div className="flex items-center gap-3 border-t pt-3">
            <span className="flex w-44 shrink-0 items-center gap-1 text-xs">
              Saturation penalty
              <HelpTip text="How hard topics that are already everywhere get pushed down. Higher = more room for niche stories." />
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.saturation_penalty_weight ?? 0.25}
              onChange={(e) =>
                setWeights((w) => ({ ...w, saturation_penalty_weight: Number(e.target.value) }))
              }
              className="h-1.5 flex-1 accent-[var(--danger)]"
            />
            <span className="w-10 text-right text-xs tabular-nums">
              ×{(weights.saturation_penalty_weight ?? 0.25).toFixed(2)}
            </span>
          </div>

          <Button onClick={handleSaveWeights} disabled={savingWeights} size="sm">
            {savingWeights ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save weights
          </Button>
        </CardContent>
      </Card>

      {/* AI model */}
      <Card>
        <CardHeader className="pb-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            AI model
            <HelpTip text="Requests walk the allowlist in fallback order when a model fails. Models marked offline are not served by the gateway right now and cannot be selected." />
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeBroken ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
              <TriangleAlert className="size-3.5 shrink-0" />
              <span>The active model is no longer working on the gateway.</span>
              {bestWorking ? (
                <Button
                  variant="outline"
                  size="xs"
                  className="ml-auto"
                  onClick={() => handleModelChange(bestWorking.id)}
                >
                  Switch to {bestWorking.label}
                </Button>
              ) : null}
            </div>
          ) : null}

          <Select value={model} onValueChange={handleModelChange}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem
                  key={m.id}
                  value={m.id}
                  disabled={!m.on_gateway}
                  title={
                    m.on_gateway
                      ? undefined
                      : 'Not available on your gateway right now — cannot be selected.'
                  }
                >
                  <span className="flex items-center gap-2">
                    {m.label}
                    {m.reasoning ? (
                      <Badge variant="outline" className="px-1 py-0 text-[10px]">
                        reasoning
                      </Badge>
                    ) : null}
                    {m.source === 'auto' ? (
                      <Badge variant="outline" className="px-1 py-0 text-[10px] text-primary">
                        auto
                      </Badge>
                    ) : null}
                    {m.on_gateway ? (
                      <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                        live
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="px-1 py-0 text-[10px]">
                        offline
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Verify availability any time with{' '}
            <code className="rounded bg-surface-muted px-1 py-0.5">php artisan ai:check-models</code>.
          </p>
        </CardContent>
      </Card>

      {/* Model resilience */}
      <Card>
        <CardHeader className="pb-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Model resilience
            <HelpTip text="OpenCode rotates its model roster without notice. Discovery ranks the gateway's current models cheap/fast-first, probes the top candidates and keeps the fastest working ones as automatic fallbacks. OpenCode's public free tier is API-blocked, so discovery uses the Go subscription roster (cost 0)." />
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs">
              Auto-discover cheap/fast fallbacks
              <HelpTip text="Runs daily (03:20) and whenever the entire fallback chain fails. Keeps the 3 fastest working models — no manual allowlist maintenance." />
            </span>
            <Switch checked={autoDiscover} onCheckedChange={handleAutoDiscoverToggle} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-surface-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {lastRefreshedAt
                ? `Last refreshed ${new Date(lastRefreshedAt).toLocaleString()}`
                : 'Not refreshed yet'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshModels}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh now
            </Button>
          </div>

          {fallbackModels.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No auto fallbacks stored yet — run a refresh to discover the best working models.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {fallbackModels.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium">{m.label}</span>
                    <span className="truncate text-muted-foreground">{m.id}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    {m.latency_ms !== null ? <span className="tabular-nums">{m.latency_ms}ms</span> : null}
                    {m.on_gateway ? (
                      <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                        live
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="px-1 py-0 text-[10px]">
                        offline
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Generation limits */}
      <Card>
        <CardHeader className="pb-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Generation limits
            <HelpTip text="Cost and safety controls for AI generation across the workspace." />
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {LIMIT_FIELDS.map(({ key, label, help }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="flex w-52 shrink-0 items-center gap-1 text-xs">
                {label}
                <HelpTip text={help} />
              </span>
              <Input
                type="number"
                min={1}
                value={limits[key] ?? ''}
                onChange={(e) => setLimits((l) => ({ ...l, [key]: Number(e.target.value) }))}
                className="h-8 w-24 text-sm"
              />
            </div>
          ))}
          <Button onClick={handleSaveLimits} disabled={savingLimits} size="sm">
            {savingLimits ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save limits
          </Button>
        </CardContent>
      </Card>

      {/* Sources */}
      <Card>
        <CardHeader className="pb-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Trend sources
            <HelpTip text="Collectors feed the pipeline. Disable a source to stop collecting from it without deleting existing items." />
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {!sources ? (
            <p className="text-xs text-muted-foreground">Loading sources…</p>
          ) : sources.length === 0 ? (
            <EmptyState title="No sources configured" />
          ) : (
            sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between border-b py-2 last:border-0"
              >
                <div>
                  <p className="text-sm">{source.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.items_count} items collected
                  </p>
                </div>
                <Switch checked={source.is_enabled} onCheckedChange={() => toggleSource(source)} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
