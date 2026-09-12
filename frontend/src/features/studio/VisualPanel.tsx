import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Copy,
  Download,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { toPng } from 'html-to-image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { HelpTip } from '@/components/shared/HelpTip'
import { cn } from '@/lib/utils'
import {
  fetchPostImages,
  suggestSnippet,
  generateImagePrompt,
  uploadImage,
  deleteImage,
  type SnippetImage,
} from '../trends/imagesApi'
import type { ContentPost } from '../trends/api'
import {
  CodeCard,
  SNIPPET_THEMES,
  SNIPPET_THEME_KEYS,
  type SnippetThemeKey,
} from './CodeCard'

const EXPORT_SIZES = {
  square: { label: 'Square · 1080×1080', width: 1080, height: 1080 },
  landscape: { label: 'Landscape · 1200×627', width: 1200, height: 627 },
} as const

type ExportSizeKey = keyof typeof EXPORT_SIZES

interface Props {
  post: ContentPost
}

export function VisualPanel({ post }: Props) {
  const [images, setImages] = useState<ImagesState | null>(null)
  const [busy, setBusy] = useState<'snippet' | 'prompt' | null>(null)
  const [theme, setTheme] = useState<SnippetThemeKey>('graphite')
  const [exportSize, setExportSize] = useState<ExportSizeKey>('square')
  const [exporting, setExporting] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  const readySnippet = images?.snippet ?? null
  const pendingSnippet = images?.pendingSnippet ?? null
  const failedSnippet = images?.failedSnippet ?? null
  const prompts = images?.prompts ?? []
  const uploads = images?.uploads ?? []
  const hasPending = pendingSnippet !== null || prompts.some((p) => p.status === 'pending')

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id])

  // Poll while a queued AI job is in flight — the panel keeps its previous
  // data, so nothing pops or collapses between refreshes.
  useEffect(() => {
    if (!hasPending) return

    const timer = setInterval(() => void refresh(), 2500)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPending])

  function refresh() {
    return fetchPostImages(post.id)
      .then(setImages)
      .catch(() => null)
  }

  function handleSuggest(force: boolean) {
    setBusy('snippet')

    suggestSnippet(post.id, force)
      .then(() => refresh())
      .catch((err: Error) => toast.error(err.message || 'Snippet suggestion failed.'))
      .finally(() => setBusy(null))
  }

  function handlePrompt() {
    setBusy('prompt')

    generateImagePrompt(post.id)
      .then(() => refresh())
      .catch((err: Error) => toast.error(err.message || 'Prompt generation failed.'))
      .finally(() => setBusy(null))
  }

  async function handleDownload() {
    if (!exportRef.current) return

    setExporting(true)

    try {
      const { width, height } = EXPORT_SIZES[exportSize]
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 1,
        width,
        height,
        cacheBust: true,
      })

      const link = document.createElement('a')
      link.download = `trend-snippet-${post.id}-${exportSize}.png`
      link.href = dataUrl
      link.click()
      toast.success('PNG downloaded.')
    } catch {
      toast.error('Export failed.')
    } finally {
      setExporting(false)
    }
  }

  async function handleUpload(file: File) {
    await uploadImage(post.id, file)
      .then(() => {
        void refresh()
        toast.success('Image uploaded.')
      })
      .catch(() => toast.error('Upload failed (max 4MB, image files).'))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── Snippet card ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              Snippet card
              <HelpTip text="A shareable code card rendered from this post. Download it as an image for LinkedIn and keep the code visually consistent." />
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSuggest(readySnippet === null && pendingSnippet === null)}
                disabled={busy !== null || pendingSnippet !== null}
              >
                {busy === 'snippet' || pendingSnippet !== null ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wand2 className="size-3.5" />
                )}
                {readySnippet ? 'Re-suggest' : 'Suggest snippet'}
              </Button>

              {readySnippet ? (
                <>
                  <Select value={theme} onValueChange={(v) => setTheme(v as SnippetThemeKey)}>
                    <SelectTrigger size="sm" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SNIPPET_THEME_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {SNIPPET_THEMES[key].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={exportSize}
                    onValueChange={(v) => setExportSize(v as ExportSizeKey)}
                  >
                    <SelectTrigger size="sm" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(EXPORT_SIZES) as ExportSizeKey[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {EXPORT_SIZES[key].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDownload()}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    PNG
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove snippet"
                    className="text-muted-foreground hover:text-danger"
                    onClick={() => setConfirmRemove(true)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {pendingSnippet !== null ? (
            <SnippetSkeleton />
          ) : failedSnippet !== null && readySnippet === null ? (
            <EmptyState
              icon={AlertTriangle}
              title="Snippet generation failed"
              description="The AI could not derive a code card from this post. Try again."
              action={
                <Button size="sm" variant="outline" onClick={() => handleSuggest(true)}>
                  Retry
                </Button>
              }
            />
          ) : readySnippet !== null && readySnippet.spec ? (
            <div className="mx-auto w-full max-w-xl">
              <div className="aspect-square w-full">
                <CodeCard spec={readySnippet.spec} theme={theme} className="h-full" />
              </div>
              <p className="pt-2 text-center text-xs text-muted-foreground">
                {readySnippet.spec.title} · {readySnippet.spec.language}
              </p>
            </div>
          ) : (
            <EmptyState
              icon={Wand2}
              title="No snippet card yet"
              description="Generate a code card from the most illustrative part of this post."
              action={
                <Button size="sm" onClick={() => handleSuggest(true)} disabled={busy !== null}>
                  Suggest snippet
                </Button>
              }
            />
          )}

          {/* Hidden fixed-size render used for crisp, shift-free PNG export */}
          {readySnippet?.spec ? (
            <div
              aria-hidden
              className="pointer-events-none fixed top-0 -left-[99999px]"
              style={{
                width: EXPORT_SIZES[exportSize].width,
                height: EXPORT_SIZES[exportSize].height,
              }}
            >
              <CodeCard ref={exportRef} spec={readySnippet.spec} theme={theme} className="h-full" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Side rail: AI images + uploads ───────────────── */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              AI image prompt
              <HelpTip text="A ready-to-paste prompt for an image generator. Trend Discover writes the prompt; you generate the image where you like." />
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handlePrompt}
              disabled={busy !== null || prompts.filter((p) => p.status === 'pending').length > 0}
            >
              {busy === 'prompt' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Generate prompt ({prompts.length}/2)
            </Button>

            {prompts.map((img) => (
              <div key={img.id} className="rounded-md border bg-surface-muted p-2.5">
                {img.status === 'pending' ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Writing prompt…
                  </p>
                ) : img.status === 'failed' ? (
                  <p className="text-xs text-danger">
                    This prompt failed to generate — remove it and try again.
                  </p>
                ) : (
                  <p className="text-xs leading-relaxed">{img.prompt_text}</p>
                )}

                <div className="mt-2 flex items-center justify-between">
                  {img.status === 'ready' ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      onClick={() => {
                        void navigator.clipboard.writeText(img.prompt_text ?? '')
                        toast.success('Prompt copied.')
                      }}
                    >
                      <Copy className="size-3" />
                      Copy prompt
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-danger"
                    onClick={() => void deleteImage(img.id).then(refresh)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-medium">Your images</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <label
              className={cn(
                'flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed py-2.5 text-xs text-muted-foreground transition-colors',
                'hover:border-primary hover:text-primary',
              )}
            >
              <ImagePlus className="size-3.5" />
              Upload an image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleUpload(file)
                  e.target.value = ''
                }}
              />
            </label>

            {uploads.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {uploads.map((upload) => (
                  <div key={upload.id} className="group relative">
                    <img
                      src={upload.url ?? ''}
                      alt="Uploaded visual"
                      className="aspect-square w-full rounded-md border object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Delete image"
                      className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-danger p-1 text-white group-hover:block"
                      onClick={() => void deleteImage(upload.id).then(refresh)}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No uploaded images yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove this snippet card?"
        description="The generated code card for this post will be deleted. You can always generate a new one."
        confirmLabel="Remove"
        onConfirm={() => {
          if (!readySnippet) return
          setConfirmRemove(false)
          void deleteImage(readySnippet.id)
            .then(refresh)
            .catch(() => toast.error('Delete failed.'))
        }}
      />
    </div>
  )
}

function SnippetSkeleton() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-surface-muted">
        <div className="flex h-full flex-col gap-3 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-center gap-2 rounded-md border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          <Loader2 className="size-3.5 animate-spin" />
          Generating snippet card…
        </span>
      </div>
    </div>
  )
}

interface ImagesState {
  snippet: SnippetImage | null
  pendingSnippet: SnippetImage | null
  failedSnippet: SnippetImage | null
  prompts: SnippetImage[]
  uploads: SnippetImage[]
}
