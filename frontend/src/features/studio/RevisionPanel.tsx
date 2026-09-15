import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CaretDownIcon,
  CheckIcon,
  CircleNotchIcon,
  MagicWandIcon,
  SparkleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  applyRevision,
  createRevision,
  discardRevision,
  fetchRevisions,
  type ContentPost,
  type PostRevision,
  type RevisionTarget,
} from '../trends/api'

interface Props {
  postId: number
  target: RevisionTarget
  onApplied: (post: ContentPost) => void
  onDismiss: () => void
  /** Called before queuing (e.g. save unsaved edits so the AI revises what you see). */
  beforeSubmit?: () => Promise<boolean>
}

const TARGET_LABEL: Record<RevisionTarget, string> = {
  hook: 'hook',
  body: 'body',
}

/**
 * Inline "Suggest improvement" workspace: describe the correction (optionally
 * paste a reference version), let the AI propose a revision, then apply or
 * discard it. The post itself only changes when Apply runs.
 */
export function RevisionPanel({ postId, target, onApplied, onDismiss, beforeSubmit }: Props) {
  const [revisions, setRevisions] = useState<PostRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [instruction, setInstruction] = useState('')
  const [reference, setReference] = useState('')
  const [showReference, setShowReference] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [applying, setApplying] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const refresh = useCallback(() => {
    return fetchRevisions(postId)
      .then(({ data }) => {
        setRevisions(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [postId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const targetRevisions = useMemo(
    () => revisions.filter((r) => r.target === target),
    [revisions, target],
  )

  const pending = targetRevisions.find((r) => r.status === 'pending') ?? null
  const ready = targetRevisions.find((r) => r.status === 'ready') ?? null
  const failed = targetRevisions.find((r) => r.status === 'failed') ?? null
  const history = targetRevisions.filter(
    (r) => r.status === 'applied' || r.status === 'discarded',
  )

  const pendingId = pending?.id ?? null

  // Poll while a proposal is in flight; stop after a minute of silence.
  useEffect(() => {
    if (pendingId === null) return

    const startedAt = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - startedAt > 60_000) {
        clearInterval(timer)
        return
      }
      void refresh()
    }, 3000)

    return () => clearInterval(timer)
  }, [pendingId, refresh])

  async function handleSubmit() {
    const text = instruction.trim()

    if (text.length < 3) {
      toast.error('Describe what should change (at least 3 characters).')
      return
    }

    setSubmitting(true)

    try {
      if (beforeSubmit && !(await beforeSubmit())) {
        return
      }

      await createRevision(postId, {
        target,
        instruction: text,
        reference: showReference && reference.trim() !== '' ? reference.trim() : undefined,
      })
      setInstruction('')
      setReference('')
      setShowReference(false)
      await refresh()
      toast.info('AI is revising — the suggestion will appear here.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not queue the revision.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApply() {
    if (!ready) return
    setApplying(true)

    try {
      const { data } = await applyRevision(postId, ready.id)
      onApplied(data)
      toast.success('Revision applied — quality re-check queued.')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Apply failed.')
    } finally {
      setApplying(false)
    }
  }

  async function handleDiscard(revision: PostRevision) {
    setBusyId(revision.id)

    try {
      await discardRevision(postId, revision.id)
      await refresh()
    } catch {
      toast.error('Could not discard the suggestion.')
    } finally {
      setBusyId(null)
    }
  }

  const isHook = target === 'hook'
  const suggested = isHook ? (ready?.hook_after ?? '') : (ready?.body_after ?? '')
  const current = isHook ? (ready?.hook_before ?? '') : (ready?.body_before ?? '')
  const charDelta = ready ? suggested.length - current.length : null

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border-strong bg-surface-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <MagicWandIcon className="size-3.5 text-signal" />
          Suggest improvement for the {TARGET_LABEL[target]}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close suggestion panel"
          onClick={onDismiss}
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>

      {/* Ready proposal */}
      {ready ? (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">Suggested revision</span>
            {charDelta !== null ? (
              <span
                className={cn(
                  'rounded-sm border px-1.5 py-0.5 font-mono text-[11px] tabular-nums',
                  charDelta === 0
                    ? 'text-muted-foreground'
                    : charDelta > 0
                      ? 'text-warning'
                      : 'text-success',
                )}
              >
                {charDelta > 0 ? '+' : ''}
                {charDelta} chars
              </span>
            ) : null}
            {ready.created_at ? (
              <span className="ml-auto text-[11px] text-muted-foreground">
                {new Date(ready.created_at).toLocaleTimeString()}
              </span>
            ) : null}
          </div>

          {ready.notes ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">What changed: </span>
              {ready.notes}
            </p>
          ) : null}

          <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-surface p-3 text-sm leading-relaxed">
            {suggested}
          </div>

          <button
            type="button"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setShowCurrent((v) => !v)}
          >
            <CaretDownIcon className={cn('size-3 transition-transform', showCurrent && 'rotate-180')} />
            {showCurrent ? 'Hide current version' : 'Compare with current version'}
          </button>

          {showCurrent ? (
            <div className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border bg-surface-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              {current}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void handleApply()} disabled={applying}>
              {applying ? <CircleNotchIcon className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />}
              Apply to post
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleDiscard(ready)}
              disabled={busyId === ready.id || applying}
            >
              Discard
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Applying creates a new version and re-runs the quality check.
            </span>
          </div>
        </div>
      ) : null}

      {/* Pending proposal */}
      {pending ? (
        <p className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
          <CircleNotchIcon className="size-3.5 animate-spin" />
          AI is revising the {TARGET_LABEL[target]} — you can keep editing while it works.
        </p>
      ) : null}

      {/* Last failure */}
      {!ready && !pending && failed ? (
        <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">
          Revision failed: {failed.error ?? 'unknown error'}
        </p>
      ) : null}

      {/* New suggestion form */}
      {!pending ? (
        <div className="space-y-2">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            placeholder={`What should change? e.g. "Barrel files don't always break tree-shaking — add nuance and keep the length."`}
            disabled={submitting}
          />

          <button
            type="button"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setShowReference((v) => !v)}
          >
            <CaretDownIcon className={cn('size-3 transition-transform', showReference && 'rotate-180')} />
            {showReference ? 'Hide reference version' : 'Paste a reference version (optional)'}
          </button>

          {showReference ? (
            <Textarea
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              rows={5}
              placeholder="Paste the better/corrected version you found — the AI adapts its accuracy and emphasis, never copies it verbatim."
              disabled={submitting}
            />
          ) : null}

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? (
                <CircleNotchIcon className="size-3.5 animate-spin" />
              ) : (
                <SparkleIcon className="size-3.5" />
              )}
              Get suggestion
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Uses ground-truth research to avoid new claims.
            </span>
          </div>
        </div>
      ) : null}

      {/* History */}
      {history.length > 0 ? (
        <div className="space-y-1.5 border-t pt-2.5">
          <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Previous suggestions</p>
          {history.slice(0, 5).map((revision) => (
            <div key={revision.id} className="flex items-center gap-2 text-[11px]">
              <span
                className={cn(
                  'shrink-0 rounded-sm border px-1.5 py-0.5',
                  revision.status === 'applied' ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {revision.status === 'applied' ? 'applied' : 'discarded'}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {revision.instruction}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <CircleNotchIcon className="size-3 animate-spin" />
          Loading suggestions…
        </p>
      ) : null}
    </div>
  )
}
