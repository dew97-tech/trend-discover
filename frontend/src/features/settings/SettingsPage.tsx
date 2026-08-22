import { useEffect, useState } from 'react'
import { Loader2, Save, Settings as SettingsIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { fetchSources, type SourceRow } from './api'

interface Weights extends Record<string, number> {}

const WEIGHT_LABELS: Array<[string, string]> = [
  ['freshness', 'Freshness'],
  ['momentum', 'Momentum'],
  ['technical_relevance', 'Technical Relevance'],
  ['practical_usefulness', 'Practical Usefulness'],
  ['novelty', 'Novelty'],
  ['developer_interest', 'Developer Interest'],
  ['discussion_potential', 'Discussion Potential'],
  ['source_reliability', 'Source Reliability'],
]

export function SettingsPage() {
  const [weights, setWeights] = useState<Weights>({})
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [model, setModel] = useState('')
  const [models, setModels] = useState<Array<{ id: string; on_gateway: boolean }>>([])
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

  useEffect(() => {
    api<{ models: Array<{ id: string; on_gateway: boolean }> }>('/settings/models')
      .then((d) => setModels(d.models))
      .catch(() => null)
  }, [])

  const weightSum = Object.entries(weights)
    .filter(([k]) => !k.includes('saturation'))
    .reduce((sum, [, v]) => sum + Number(v), 0)

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
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <SettingsIcon className="size-6 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Runtime configuration — changes apply without redeploying.
        </p>
      </header>

      {/* Scoring weights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-semibold">
            Trend Scoring Weights
            <Badge variant={Math.abs(weightSum - 1) <= 0.05 ? 'secondary' : 'destructive'}>
              sum {weightSum.toFixed(2)} / 1.00
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {WEIGHT_LABELS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <Label htmlFor={`w-${key}`} className="w-44 shrink-0 text-xs">
                {label}
              </Label>
              <input
                id={`w-${key}`}
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={weights[key] ?? 0}
                onChange={(e) =>
                  setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))
                }
                className="h-1.5 flex-1 accent-[var(--primary)]"
              />
              <span className="w-12 text-right text-xs tabular-nums">
                {(weights[key] ?? 0).toFixed(2)}
              </span>
            </div>
          ))}

          <div className="flex items-center gap-3 border-t pt-3">
            <Label htmlFor="sat" className="w-44 shrink-0 text-xs">
              Saturation Penalty
            </Label>
            <input
              id="sat"
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
            <span className="w-12 text-right text-xs tabular-nums">
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
          <CardTitle className="text-sm font-semibold">AI Model</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={model} onValueChange={handleModelChange}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="flex items-center gap-2">
                    {m.id}
                    {m.on_gateway ? (
                      <Badge variant="secondary" className="px-1 py-0 text-[10px]">live</Badge>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            Allowlisted models only. "live" = confirmed available on the gateway right now.
          </p>
        </CardContent>
      </Card>

      {/* Generation limits */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Generation Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            ['max_generations_per_trend', 'Max generations per trend'],
            ['max_image_prompts_per_post', 'Max image prompts per post'],
            ['daily_ai_call_budget', 'Daily AI call budget'],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <Label htmlFor={`l-${key}`} className="w-52 shrink-0 text-xs">
                {label}
              </Label>
              <Input
                id={`l-${key}`}
                type="number"
                min={1}
                value={limits[key] ?? ''}
                onChange={(e) =>
                  setLimits((l) => ({ ...l, [key]: Number(e.target.value) }))
                }
                className="w-24"
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
          <CardTitle className="text-sm font-semibold">Trend Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!sources ? (
            <p className="text-xs text-muted-foreground">Loading sources…</p>
          ) : (
            sources.map((source) => (
              <div key={source.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm">{source.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.items_count} items collected
                  </p>
                </div>
                <Switch
                  checked={source.is_enabled}
                  onCheckedChange={() => toggleSource(source)}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
