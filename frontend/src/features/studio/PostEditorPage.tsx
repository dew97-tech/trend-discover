import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  CheckIcon,
  CircleNotchIcon,
  CopyIcon,
  FloppyDiskIcon,
  HashIcon,
  MagicWandIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Field } from '@/components/shared/Field'
import { HelpTip } from '@/components/shared/HelpTip'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { contentFormatLabel } from '@/lib/content-formats'
import { cn } from '@/lib/utils'
import {
  deletePost,
  fetchPost,
  fetchPosts,
  generatePostHashtags,
  patchPost,
  regeneratePost,
  type ContentPost,
  type RevisionTarget,
} from '../trends/api'
import { FormatPickerDialog } from '../trends/FormatPickerDialog'
import { RevisionPanel } from './RevisionPanel'
import { PostBodyPreview } from './PostBodyPreview'
import { VisualPanel } from './VisualPanel'

const QUALITY_DIMENSIONS: Array<[string, string, string]> = [
  ['technical_accuracy', 'Technical accuracy', 'Are the claims correct and defensible?'],
  ['novelty', 'Novelty', 'Does it say something non-obvious rather than repeating common knowledge?'],
  ['practical_value', 'Practical value', 'Can a working engineer act on this tomorrow?'],
  ['readability', 'Readability', 'Scannable paragraphs, clean flow, no AI-speak.'],
  ['engagement_potential', 'Engagement', 'Would engineers comment with their own experience?'],
  ['source_confidence', 'Source confidence', 'How well the sources support every claim made.'],
]

type EditorTab = 'write' | 'preview' | 'quality' | 'visuals'

export function PostEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [post, setPost] = useState<ContentPost | null>(null)
  const [siblings, setSiblings] = useState<ContentPost[]>([])
  const [title, setTitle] = useState('')
  const [hook, setHook] = useState('')
  const [body, setBody] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [suggestingTags, setSuggestingTags] = useState(false)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<EditorTab>('write')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [revisionTarget, setRevisionTarget] = useState<RevisionTarget | null>(null)

  useEffect(() => {
    if (!id) return

    setPost(null)
    setDirty(false)

    fetchPost(Number(id))
      .then(({ data }: { data: ContentPost }) => {
        setPost(data)
        setTitle(data.title ?? '')
        setHook(data.hook ?? '')
        setBody(data.body)
        setHashtags(data.hashtags ?? [])
      })
      .catch(() => toast.error('Failed to load post.'))
  }, [id])

  // Sibling variants of the same trend — quick comparison/switching.
  useEffect(() => {
    if (!post?.trend_id) return

    fetchPosts({ trend_id: String(post.trend_id), per_page: '50' })
      .then((res) => setSiblings(res.data))
      .catch(() => null)
  }, [post?.trend_id])

  const copyText = useMemo(() => {
    const full = [hook.trim(), body.trim()].filter(Boolean).join('\n\n')

    if (!includeHashtags || hashtags.length === 0) return full

    return `${full}\n\n${hashtags.map((tag) => `#${tag}`).join(' ')}`
  }, [hook, body, hashtags, includeHashtags])

  function handleSave() {
    if (!post) return
    setSaving(true)

    patchPost(post.id, { title, hook, body, hashtags })
      .then(({ data }: { data: ContentPost }) => {
        setPost({ ...data, trend: post.trend })
        setHashtags(data.hashtags ?? hashtags)
        setDirty(false)
        toast.success('Saved — new version created.')
      })
      .catch(() => toast.error('Save failed.'))
      .finally(() => setSaving(false))
  }

  /**
   * Revisions run against the saved post — flush pending edits first so the
   * AI revises exactly what the author sees.
   */
  async function saveBeforeRevision(): Promise<boolean> {
    if (!post || !dirty) return true

    try {
      const { data }: { data: ContentPost } = await patchPost(post.id, {
        title,
        hook,
        body,
        hashtags,
      })
      setPost({ ...data, trend: post.trend })
      setHashtags(data.hashtags ?? hashtags)
      setDirty(false)

      return true
    } catch {
      toast.error('Could not save your edits before suggesting — try again.')

      return false
    }
  }

  function handleRevisionApplied(updated: ContentPost) {
    setPost({ ...updated, trend: post?.trend })
    setTitle(updated.title ?? '')
    setHook(updated.hook ?? '')
    setBody(updated.body)
    setHashtags(updated.hashtags ?? [])
    setDirty(false)
  }

  function handleRegenerate() {
    if (!post) return
    setRegenerating(true)

    regeneratePost(post.id)
      .then(() => {
        toast.info('New generation queued — it will appear as another post in Post Studio.', {
          action: { label: 'Open Post Studio', onClick: () => navigate('/studio') },
        })
      })
      .catch(() => toast.error('Regeneration failed.'))
      .finally(() => setRegenerating(false))
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success(
      includeHashtags && hashtags.length > 0
        ? 'Copied with hashtags — paste into LinkedIn.'
        : 'Copied — paste into LinkedIn.',
    )
  }

  async function handleDelete() {
    if (!post) return
    setDeleting(true)

    try {
      await deletePost(post.id)
      toast.success('Post deleted.')
      navigate('/studio')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.')
      setDeleting(false)
    }
  }

  function addTag(raw: string) {
    const tag = raw.replace(/^#+/, '').replace(/[^A-Za-z0-9]/g, '')
    if (tag === '') return

    setHashtags((prev) => {
      if (prev.some((t) => t.toLowerCase() === tag.toLowerCase())) return prev
      if (prev.length >= 8) {
        toast.error('Maximum 8 hashtags.')
        return prev
      }
      return [...prev, tag]
    })
    setTagInput('')
    setDirty(true)
  }

  function removeTag(tag: string) {
    setHashtags((prev) => prev.filter((t) => t !== tag))
    setDirty(true)
  }

  function handleSuggestHashtags() {
    if (!post || suggestingTags) return

    setSuggestingTags(true)

    generatePostHashtags(post.id)
      .then(() => {
        toast.info('Choosing hashtags with AI…', { duration: 4000 })

        const startedAt = Date.now()
        const timer = setInterval(() => {
          fetchPost(post.id)
            .then(({ data }) => {
              if ((data.hashtags?.length ?? 0) > 0) {
                clearInterval(timer)
                setHashtags(data.hashtags ?? [])
                setPost((prev) => (prev ? { ...prev, hashtags: data.hashtags } : prev))
                setSuggestingTags(false)
                toast.success('Hashtags ready — review and save.')
              } else if (Date.now() - startedAt > 45_000) {
                clearInterval(timer)
                setSuggestingTags(false)
                toast.error('Still working — check again in a moment.')
              }
            })
            .catch(() => {
              clearInterval(timer)
              setSuggestingTags(false)
            })
        }, 3000)
      })
      .catch(() => {
        setSuggestingTags(false)
        toast.error('Could not queue hashtag generation.')
      })
  }

  if (!post) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <CircleNotchIcon className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const dimensions = post.quality_breakdown?.dimensions ?? {}
  const issues = post.quality_breakdown?.issues ?? []

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 pt-8 pb-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/studio')}>
          <ArrowLeftIcon className="size-4" />
          Post Studio
        </Button>
        <div className="flex items-center gap-2">
          <StatusBadge status={post.status} />
          <Badge variant="outline" className="font-normal">
            {contentFormatLabel(post.format)}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          {title || hook || 'Untitled post'}
        </h1>
        {post.trend ? (
          <p className="text-sm text-muted-foreground">
            From trend:{' '}
            <Link to="/trends" className="text-signal hover:underline">
              {post.trend.title}
            </Link>{' '}
            · {post.tone}
            {post.angle ? ` · ${post.angle}` : ''} · v{post.version_count ?? 1}
          </p>
        ) : null}
      </div>

      {/* Post switcher — all posts generated from this trend */}
      <div className="flex flex-wrap items-center gap-1.5">
        {siblings.map((sibling) => {
          const active = sibling.id === post.id

          return (
            <button
              key={sibling.id}
              type="button"
              onClick={() => !active && navigate(`/studio/${sibling.id}`)}
              className={cn(
                'rounded-sm border px-2.5 py-1 text-xs transition-colors duration-150',
                active
                  ? 'border-border-strong bg-surface-muted font-medium text-foreground'
                  : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
              )}
              title={sibling.hook ?? sibling.title ?? undefined}
            >
              {contentFormatLabel(sibling.format)} · {sibling.tone}
              {sibling.angle ? ` · ${sibling.angle}` : ''}
            </button>
          )
        })}
        <Button variant="ghost" size="xs" onClick={() => setPickerOpen(true)}>
          <PlusIcon className="size-3" />
          Generate another post
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as EditorTab)}>
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="visuals">Visuals</TabsTrigger>
        </TabsList>

        {/* ── Write ─────────────────────────────────────────── */}
        <TabsContent value="write" className="space-y-4 pt-2">
          <Field
            label="Internal title"
            htmlFor="post-title"
            help="Never published — it only labels this post inside the app."
          >
            <Textarea
              id="post-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setDirty(true)
              }}
              rows={2}
            />
          </Field>

          <Field
            label="Hook"
            htmlFor="post-hook"
            help="First line of the post. LinkedIn truncates around 210 characters with “see more”."
            hint={`${hook.length} characters`}
            action={
              <Button
                variant="outline"
                size="xs"
                onClick={() => setRevisionTarget(revisionTarget === 'hook' ? null : 'hook')}
              >
                <MagicWandIcon className="size-3" />
                Suggest improvement
              </Button>
            }
          >
            <Textarea
              id="post-hook"
              value={hook}
              onChange={(e) => {
                setHook(e.target.value)
                setDirty(true)
              }}
              rows={2}
            />
            {revisionTarget === 'hook' ? (
              <RevisionPanel
                postId={post.id}
                target="hook"
                onApplied={handleRevisionApplied}
                onDismiss={() => setRevisionTarget(null)}
                beforeSubmit={saveBeforeRevision}
              />
            ) : null}
          </Field>

          <Field
            label="Body"
            htmlFor="post-body"
            help="The post content. The hook above is published as its first line — don't repeat it here. LinkedIn allows up to 3000 characters; 900–1600 performs best."
            hint={
              <span
                className={cn(
                  body.length > 3000 && 'font-medium text-danger',
                )}
              >
                {body.length} / 3000 characters
              </span>
            }
            action={
              <Button
                variant="outline"
                size="xs"
                onClick={() => setRevisionTarget(revisionTarget === 'body' ? null : 'body')}
              >
                <MagicWandIcon className="size-3" />
                Suggest improvement
              </Button>
            }
          >
            <Textarea
              id="post-body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                setDirty(true)
              }}
              rows={14}
            />
            {revisionTarget === 'body' ? (
              <RevisionPanel
                postId={post.id}
                target="body"
                onApplied={handleRevisionApplied}
                onDismiss={() => setRevisionTarget(null)}
                beforeSubmit={saveBeforeRevision}
              />
            ) : null}
          </Field>

          <Field
            label="Hashtags"
            help="3–5 focused tags outperform generic ones. Click a tag to remove it."
            hint={`${hashtags.length} of 8 — Copied posts include them at the end.`}
          >
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-muted px-2 py-0.5 font-mono text-xs text-foreground"
                  >
                    #{tag}
                    <button
                      type="button"
                      aria-label={`Remove #${tag}`}
                      className="rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                      onClick={() => removeTag(tag)}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
                {hashtags.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    No hashtags yet — add up to 8.
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag(tagInput)
                    }
                  }}
                  placeholder="Add a tag and press Enter"
                  aria-label="Add a hashtag"
                  spellCheck={false}
                  className="h-8 max-w-56 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addTag(tagInput)}
                  disabled={tagInput.trim() === ''}
                >
                  Add
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestHashtags}
                  disabled={suggestingTags}
                >
                  {suggestingTags ? (
                    <CircleNotchIcon className="size-3.5 animate-spin" />
                  ) : (
                    <SparkleIcon className="size-3.5" />
                  )}
                  Suggest with AI
                </Button>
              </div>
            </div>
          </Field>
        </TabsContent>

        {/* ── Preview ───────────────────────────────────────── */}
        <TabsContent value="preview" className="pt-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">LinkedIn preview</p>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HashIcon className="size-3" />
                  Include hashtags
                  <Switch
                    checked={includeHashtags}
                    onCheckedChange={setIncludeHashtags}
                    className="scale-75"
                  />
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <PostBodyPreview
                hook={hook}
                body={body}
                hashtags={hashtags}
                includeHashtags={includeHashtags}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Quality ───────────────────────────────────────── */}
        <TabsContent value="quality" className="pt-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Quality check
                  <HelpTip
                    className="ml-1.5"
                    text="Overall quality from six dimensions plus automatic checks. 80+ is ready to post, 60–79 needs a quick review."
                  />
                </p>
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {post.quality_score !== null ? Math.round(post.quality_score) : '—'}
                  <span className="font-sans text-xs font-normal text-muted-foreground">/100</span>
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {QUALITY_DIMENSIONS.map(([key, label, help]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="flex w-36 shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {label}
                    <HelpTip text={help} />
                  </span>
                  <Progress value={dimensions[key] ?? 0} className="h-1.5 min-w-0 flex-1" />
                  <span className="w-7 shrink-0 text-right font-mono text-xs tabular-nums">
                    {Math.round(dimensions[key] ?? 0)}
                  </span>
                </div>
              ))}

              {issues.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 border-t border-border pt-3 pl-4">
                  {issues.map((issue: string, i: number) => (
                    <li key={i} className="text-xs text-warning">
                      {issue}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t border-border pt-3 text-xs text-success">No issues flagged.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Visuals ───────────────────────────────────────── */}
        <TabsContent value="visuals" className="pt-2">
          <VisualPanel post={post} />
        </TabsContent>
      </Tabs>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-[var(--z-sticky)] -mx-4 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? (
            <CircleNotchIcon className="size-4 animate-spin" />
          ) : dirty ? (
            <FloppyDiskIcon className="size-4" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          {dirty ? 'Save version' : 'Saved'}
        </Button>
        <Button variant="outline" onClick={handleCopy} disabled={copied}>
          {copied ? <CheckIcon className="size-4 text-success" /> : <CopyIcon className="size-4" />}
          {copied ? 'Copied' : 'Copy for LinkedIn'}
        </Button>
        <Button
          variant="outline"
          onClick={handleRegenerate}
          disabled={regenerating}
          title="Queues a fresh AI draft with the same style, voice and angle — appears as another post"
        >
          <ArrowsClockwiseIcon className={cn('size-4', regenerating && 'animate-spin')} />
          Generate again
        </Button>
        <Button
          variant="ghost"
          className="ml-auto text-muted-foreground hover:text-danger"
          onClick={() => setConfirmDelete(true)}
        >
          <TrashIcon className="size-4" />
          Delete post
        </Button>
      </div>

      <FormatPickerDialog
        trendId={post.trend_id}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onQueued={() => navigate('/studio')}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this post?"
        description={
          <>
            This post will be permanently removed, including its version history and attached
            images. This cannot be undone.
          </>
        }
        confirmLabel="Delete post"
        onConfirm={() => void handleDelete()}
        loading={deleting}
      />
    </div>
  )
}
