import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Copy, Loader2, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { fetchPost, patchPost, regeneratePost, type ContentPost } from '../trends/api'
import { VisualPanel } from './VisualPanel'
import { cn } from '@/lib/utils'

const DIMENSION_LABELS: Array<[string, string]> = [
  ['technical_accuracy', 'Technical Accuracy'],
  ['novelty', 'Novelty'],
  ['practical_value', 'Practical Value'],
  ['readability', 'Readability'],
  ['engagement_potential', 'Engagement'],
  ['source_confidence', 'Source Confidence'],
]

const STATUS_STYLES: Record<string, string> = {
  ready: 'bg-success-soft text-success',
  review: 'bg-warning-soft text-warning',
  draft: 'bg-surface-muted text-muted-foreground',
}

export function PostEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [post, setPost] = useState<ContentPost | null>(null)
  const [title, setTitle] = useState('')
  const [hook, setHook] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchPost(Number(id))
      .then(({ data }: { data: ContentPost }) => {
        setPost(data)
        setTitle(data.title ?? '')
        setHook(data.hook ?? '')
        setBody(data.body)
      })
      .catch(() => toast.error('Failed to load post.'))
  }, [id])

  function handleSave() {
    if (!post) return
    setSaving(true)

    patchPost(post.id, { title, hook, body })
      .then(({ data }: { data: ContentPost }) => {
        setPost(data)
        setDirty(false)
        toast.success('Saved — new version created.')
      })
      .catch(() => toast.error('Save failed.'))
      .finally(() => setSaving(false))
  }

  function handleRegenerate() {
    if (!post) return
    setRegenerating(true)

    regeneratePost(post.id)
      .then(() => {
        toast.info('Regeneration queued. Refresh in a few seconds.')
        setTimeout(() => window.location.reload(), 4000)
      })
      .catch(() => {
        toast.error('Regeneration failed.')
        setRegenerating(false)
      })
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied — paste it into LinkedIn.')
  }

  if (!post) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const dimensions = post.quality_breakdown?.dimensions ?? {}
  const issues = post.quality_breakdown?.issues ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/studio')}>
          <ArrowLeft className="size-4" />
          Studio
        </Button>
        <div className="flex items-center gap-2">
          {post.status && (
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold',
                STATUS_STYLES[post.status] ?? 'bg-surface-muted',
              )}
            >
              {post.status.replaceAll('_', ' ')}
            </span>
          )}
          <Badge variant="secondary" className="text-xs capitalize">
            {post.format.replaceAll('_', ' ')}
          </Badge>
        </div>
      </div>

      {post.trend ? (
        <p className="text-xs text-muted-foreground">
          From trend:{' '}
          <Link to="/trends" className="text-primary hover:underline">
            {post.trend.title}
          </Link>{' '}
          · v{post.version_count ?? 1}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Editor column */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Working title (internal)</Label>
            <Textarea
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setDirty(true)
              }}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Hook</Label>
            <Textarea
              value={hook}
              onChange={(e) => {
                setHook(e.target.value)
                setDirty(true)
              }}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Body — {body.length} chars</Label>
            <Textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                setDirty(true)
              }}
              rows={16}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : dirty ? <Save className="size-4" /> : <Check className="size-4" />}
              {dirty ? 'Save version' : 'Saved'}
            </Button>
            <Button variant="outline" onClick={handleCopy} disabled={copied}>
              {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              {copied ? 'Copied' : 'Copy for LinkedIn'}
            </Button>
            <Button variant="outline" onClick={handleRegenerate} disabled={regenerating} className="ml-auto">
              <RefreshCw className={cn('size-4', regenerating && 'animate-spin')} />
              Regenerate
            </Button>
          </div>
        </div>

        {/* Preview + quality column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                LinkedIn preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-white p-4 text-[13px] leading-relaxed whitespace-pre-wrap dark:bg-surface">
                {body}
              </div>
              <p className="mt-2 text-right text-[11px] text-muted-foreground">{body.length}/3000</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Content quality{' '}
                <span className="float-right text-base font-bold tabular-nums">
                  {post.quality_score !== null ? Math.round(post.quality_score) : '—'}/100
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {DIMENSION_LABELS.map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{label}</span>
                  <Progress value={dimensions[key] ?? 0} className="h-1.5 flex-1" />
                  <span className="w-7 text-right text-[11px] tabular-nums">
                    {Math.round(dimensions[key] ?? 0)}
                  </span>
                </div>
              ))}

              {issues.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t pt-3">
                  {issues.map((issue: string, i: number) => (
                    <li key={i} className="text-[11px] text-warning">• {issue}</li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <VisualPanel post={post} />

          {!post ? <Skeleton className="h-20 rounded-lg" /> : null}
        </div>
      </div>
    </div>
  )
}
