import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Copy, Info, Loader2, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { fetchPost, patchPost, regeneratePost, type ContentPost } from '../trends/api'
import { VisualPanel } from './VisualPanel'
import { cn } from '@/lib/utils'

function InfoHint({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="cursor-help text-muted-foreground/60 hover:text-muted-foreground">
            <Info className="size-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const DIMENSION_LABELS: Array<[string, string, string]> = [
  ['technical_accuracy', 'Technical Accuracy', 'Are the claims technically correct and defensible?'],
  ['novelty', 'Novelty', 'Does it say something non-obvious rather than repeating common knowledge?'],
  ['practical_value', 'Practical Value', 'Can a working engineer act on this tomorrow?'],
  ['readability', 'Readability', 'Scannable paragraphs, clean flow, no AI-speak.'],
  ['engagement_potential', 'Engagement', 'Would engineers comment with their own experience?'],
  ['source_confidence', 'Source Confidence', 'How well the sources support every claim made.'],
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
  const [railTab, setRailTab] = useState<'preview' | 'quality' | 'visual'>('preview')

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

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Editor column */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="flex items-center gap-1.5">
              Working title (internal)
              <InfoHint text="Never shown on LinkedIn — just for organizing your library." />
            </Label>
            <Textarea
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setDirty(true)
              }}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hook" className="flex items-center gap-1.5">
              Hook
              <InfoHint text="The first line of your post — it earns the scroll. LinkedIn truncates after ~210 chars with 'see more'." />
            </Label>
            <Textarea
              id="hook"
              value={hook}
              onChange={(e) => {
                setHook(e.target.value)
                setDirty(true)
              }}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body" className="flex items-center gap-1.5">
              Body — {body.length} chars
              <InfoHint text="LinkedIn's hard limit is 3000 characters; the sweet spot is 900–1600." />
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                setDirty(true)
              }}
              rows={16}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-2 lg:sticky lg:bottom-0 lg:bg-background lg:py-2">
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : dirty ? <Save className="size-4" /> : <Check className="size-4" />}
              {dirty ? 'Save version' : 'Saved'}
            </Button>
            <Button variant="outline" onClick={handleCopy} disabled={copied}>
              {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              {copied ? 'Copied' : 'Copy for LinkedIn'}
            </Button>
            <Button
              variant="outline"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="ml-auto"
              title="Generates a fresh AI draft in this post's format & tone"
            >
              <RefreshCw className={cn('size-4', regenerating && 'animate-spin')} />
              Regenerate
            </Button>
          </div>
        </div>

        {/* Sticky rail — one surface, tab-switched */}
        <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <Tabs
            value={railTab}
            onValueChange={(v) => setRailTab(v as typeof railTab)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="quality">Quality</TabsTrigger>
              <TabsTrigger value="visual">Visual</TabsTrigger>
            </TabsList>
          </Tabs>

          {railTab === 'preview' ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  LinkedIn preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-white p-4 text-[13px] leading-relaxed whitespace-pre-wrap dark:bg-surface">
                  {body}
                </div>
                <p className="mt-2 text-right text-[11px] text-muted-foreground">{body.length}/3000</p>
              </CardContent>
            </Card>
          ) : null}

          {railTab === 'quality' ? (
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
                {DIMENSION_LABELS.map(([key, label, help]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span
                      className="w-28 shrink-0 cursor-help text-[11px] text-muted-foreground underline decoration-dotted decoration-border underline-offset-2"
                      title={help}
                    >
                      {label}
                    </span>
                    <Progress value={dimensions[key] ?? 0} className="h-1.5 min-w-0 flex-1" />
                    <span className="w-7 shrink-0 text-right text-[11px] tabular-nums">
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
          ) : null}

          {railTab === 'visual' ? <VisualPanel post={post} /> : null}
        </div>
      </div>
    </div>
  )
}
