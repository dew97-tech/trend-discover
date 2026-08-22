import { useEffect, useRef, useState } from 'react'
import { Download, ImagePlus, Loader2, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { toPng } from 'html-to-image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  fetchPostImages,
  suggestSnippet,
  generateImagePrompt,
  uploadImage,
  deleteImage,
} from '../trends/imagesApi'
import type { ContentPost } from '../trends/api'
import { CodeCard, GRADIENT_KEYS, type CodeCardSpec, type GradientKey } from './CodeCard'

interface Props {
  post: ContentPost
}

export function VisualPanel({ post }: Props) {
  const [images, setImages] = useState<ImagesState | null>(null)
  const [busy, setBusy] = useState<'snippet' | 'prompt' | null>(null)
  const [gradient, setGradient] = useState<GradientKey>('science')
  const cardRef = useRef<HTMLDivElement>(null)

  const snippet = images?.snippet ?? null
  const prompts = images?.prompts ?? []
  const hasPending =
    snippet?.status === 'pending' || prompts.some((p) => p.status === 'pending')
  const failedSnippet = images?.failedSnippet ?? null

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id])

  // Poll while anything is pending — jobs run in workers (AI calls take
  // 30–90s+), so the UI must self-update.
  useEffect(() => {
    if (!hasPending) return

    const timer = setInterval(refresh, 2500)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPending])

  function refresh() {
    fetchPostImages(post.id)
      .then(setImages)
      .catch(() => null)
  }

  function handleSuggest(force: boolean) {
    setBusy('snippet')
    suggestSnippet(post.id, force)
      .then(refresh)
      .catch((err: Error) => toast.error(err.message || 'Snippet suggestion failed.'))
      .finally(() => setBusy(null))
  }

  function handlePrompt() {
    setBusy('prompt')
    generateImagePrompt(post.id)
      .then(refresh)
      .catch((err: Error) => toast.error(err.message || 'Prompt generation failed.'))
      .finally(() => setBusy(null))
  }

  async function handleDownload() {
    if (!cardRef.current) return
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `trend-snippet-${post.id}.png`
      link.href = dataUrl
      link.click()
      toast.success('PNG downloaded.')
    } catch {
      toast.error('Export failed.')
    }
  }

  async function handleUpload(file: File) {
    await uploadImage(post.id, file)
      .then(() => {
        refresh()
        toast.success('Image uploaded.')
      })
      .catch(() => toast.error('Upload failed (max 4MB, image files).'))
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Visual assets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Snippet card */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleSuggest(snippet === null)}
            disabled={busy !== null}
          >
            {busy === 'snippet' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Wand2 className="size-3.5" />
            )}
            {snippet ? 'Re-suggest snippet' : 'Suggest snippet'}
          </Button>

          {snippet ? (
            <>
              <Select
                value={gradient}
                onValueChange={(v) => setGradient(v as GradientKey)}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADIENT_KEYS.map((key) => (
                    <SelectItem key={key} value={key} className="capitalize">
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                title="Download PNG"
                onClick={handleDownload}
              >
                <Download className="size-3.5" />
              </Button>
            </>
          ) : null}
        </div>

        {snippet && snippet.status === 'pending' ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            AI is crafting your snippet card… this can take up to a minute.
          </div>
        ) : failedSnippet ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-danger-soft p-3 text-xs text-danger">
            <span>Snippet generation failed.</span>
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => handleSuggest(true)}
            >
              retry
            </button>
          </div>
        ) : snippet ? (
          <div className="space-y-2">
            <CodeCard
              ref={cardRef}
              gradient={gradient}
              spec={snippet.spec as unknown as CodeCardSpec}
            />
            <p className="text-right">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-danger"
                onClick={() =>
                  deleteImage(snippet.id).then(refresh).catch(() => toast.error('Delete failed.'))
                }
              >
                <Trash2 className="size-3" /> remove
              </button>
            </p>
          </div>
        ) : null}

        {/* AI image prompt */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handlePrompt}
            disabled={busy !== null}
          >
            {busy === 'prompt' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Generate image prompt ({prompts.length}/2)
          </Button>
        </div>

        {prompts
          .filter((img) => img.status !== 'pending')
          .map((img) => (
            <div key={img.id} className="rounded-md border bg-surface-muted p-2.5">
              {img.status === 'failed' ? (
                <p className="text-[11px] text-danger">
                  This prompt failed to generate — try again.
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed">{img.prompt_text}</p>
              )}
              {img.status === 'ready' ? (
                <div className="mt-1.5 flex items-center justify-between">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    onClick={() => {
                      navigator.clipboard.writeText(img.prompt_text ?? '')
                      toast.success('Prompt copied.')
                    }}
                  >
                    <CopyIcon /> copy prompt
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-danger"
                    onClick={() => deleteImage(img.id).then(refresh)}
                  >
                    remove
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 text-right">
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-danger"
                    onClick={() => deleteImage(img.id).then(refresh)}
                  >
                    remove
                  </button>
                </div>
              )}
            </div>
          ))}

        {/* Manual upload */}
        <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
          <ImagePlus className="size-3.5" />
          Upload your own image
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

        {(images?.uploads.length ?? 0) > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {images?.uploads.map((upload) => (
              <div key={upload.id} className="group relative">
                <img
                  src={upload.url ?? ''}
                  alt="uploaded visual"
                  className="aspect-square w-full rounded-md border object-cover"
                />
                <button
                  type="button"
                  aria-label="delete upload"
                  className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-danger p-1 text-white group-hover:block"
                  onClick={() => deleteImage(upload.id).then(refresh)}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

interface ImagesState {
  snippet: SnippetImage | null
  pendingSnippet: SnippetImage | null
  failedSnippet: SnippetImage | null
  prompts: SnippetImage[]
  uploads: SnippetImage[]
}

interface SnippetImage {
  id: number
  status: 'pending' | 'ready' | 'failed'
  spec: CodeCardSpec | null
  prompt_text: string | null
  url: string | null
}
