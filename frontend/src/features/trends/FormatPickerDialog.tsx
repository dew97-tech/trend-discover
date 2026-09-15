import { useEffect, useState } from 'react'
import { CircleNotchIcon, SparkleIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { HelpTip } from '@/components/shared/HelpTip'
import { CONTENT_FORMATS, contentFormatDescription, contentFormatLabel } from '@/lib/content-formats'
import { generatePost, type GenerateSpec } from './api'

const TONES: Array<{ value: string; label: string; description: string }> = [
  {
    value: 'technical',
    label: 'Technical',
    description: 'Precise, code-forward, no fluff. The default for engineer audiences.',
  },
  {
    value: 'conversational',
    label: 'Conversational',
    description: 'Relaxed first-person voice, as if explaining to a colleague over coffee.',
  },
  {
    value: 'storytelling',
    label: 'Storytelling',
    description: 'Narrative arc — situation, problem, resolution. Good for lessons learned.',
  },
  {
    value: 'contrarian',
    label: 'Contrarian',
    description: 'Challenges a common assumption, then defends the position honestly.',
  },
]

interface Props {
  trendId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onQueued?: () => void
  /** Formats already generated for this trend — shows a duplicate hint. */
  existingFormats?: string[]
}

export function FormatPickerDialog({
  trendId,
  open,
  onOpenChange,
  onQueued,
  existingFormats = [],
}: Props) {
  const [format, setFormat] = useState('quick_tip')
  const [tone, setTone] = useState('technical')
  const [angle, setAngle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setAngle('')
      setSubmitting(false)
    }
  }, [open])

  const duplicate = existingFormats.includes(format)

  function handleGenerate() {
    setSubmitting(true)

    const spec: GenerateSpec = { format, tone }
    if (angle.trim() !== '') spec.angle = angle.trim()

    generatePost(trendId, spec)
      .then(() => {
        toast.success('Generation queued — it will appear in Post Studio shortly.')
        onOpenChange(false)
        onQueued?.()
      })
      .catch(() => toast.error('Could not queue generation. Try again.'))
      .finally(() => setSubmitting(false))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparkleIcon className="size-4 text-signal" />
            Create a post
          </DialogTitle>
          <DialogDescription>
            One post per style + voice + angle. The AI researches the trend automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label id="format-label">Style</Label>
              <HelpTip text="The shape the post takes. Tip formats are the practical, tutorial-style core of this tool." />
            </div>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="w-full" aria-labelledby="format-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {CONTENT_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                    {existingFormats.includes(f.value) ? (
                      <span className="text-muted-foreground"> · used</span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{contentFormatDescription(format)}</p>
            {duplicate ? (
              <p className="text-xs text-warning">
                A {contentFormatLabel(format)} post already exists for this trend — creating
                again adds another one you can compare and delete.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label id="tone-label">Voice</Label>
              <HelpTip text="How the post sounds. Keep one voice per post so comparisons stay honest." />
            </div>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="w-full" aria-labelledby="tone-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TONES.find((t) => t.value === tone)?.description}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="generate-angle">
                Angle <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <HelpTip text="Steers the draft — e.g. “focus on the migration path” or “compare with PostgreSQL”." />
            </div>
            <Textarea
              id="generate-angle"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="e.g. focus on the N+1 query fix"
              rows={3}
            />
          </div>

          <Button onClick={handleGenerate} disabled={submitting} className="w-full">
            {submitting ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
            Create post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
