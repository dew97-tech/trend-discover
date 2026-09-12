import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
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
import { generatePost, type GenerateSpec } from './api'

export const POST_FORMATS: Array<{ value: string; label: string }> = [
  { value: 'quick_tip', label: 'Quick Tip' },
  { value: 'laravel_hack', label: 'Laravel Hack' },
  { value: 'sql_hack', label: 'SQL Hack' },
  { value: 'react_hack', label: 'React Hack' },
  { value: 'nextjs_hack', label: 'Next.js Hack' },
  { value: 'technical_insight', label: 'Technical Insight' },
  { value: 'optimization_tip', label: 'Optimization Tip' },
  { value: 'problem_solution', label: 'Problem → Solution' },
  { value: 'before_after', label: 'Before → After' },
  { value: 'engineering_lesson', label: 'Engineering Lesson' },
  { value: 'release_highlight', label: 'Release Highlight' },
  { value: 'tool_discovery', label: 'Tool Discovery' },
  { value: 'performance_breakdown', label: 'Performance Breakdown' },
  { value: 'architecture_insight', label: 'Architecture Insight' },
  { value: 'debugging_story', label: 'Debugging Story' },
  { value: 'developer_debate', label: 'Developer Debate' },
  { value: 'case_study', label: 'Case Study' },
]

const TONES = [
  { value: 'technical', label: 'Technical' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'contrarian', label: 'Contrarian' },
]

interface Props {
  trendId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onQueued?: () => void
}

export function FormatPickerDialog({ trendId, open, onOpenChange, onQueued }: Props) {
  const [format, setFormat] = useState('technical_insight')
  const [tone, setTone] = useState('technical')
  const [angle, setAngle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleGenerate() {
    setSubmitting(true)

    const spec: GenerateSpec = { format, tone }
    if (angle.trim() !== '') spec.angle = angle.trim()

    generatePost(trendId, spec)
      .then(() => {
        toast.success('Generation queued — the post will appear in Post Studio shortly.')
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
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            Generate LinkedIn post
          </DialogTitle>
          <DialogDescription>
            Pick a format and tone. Research runs automatically from this trend's signals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {POST_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger>
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
          </div>

          <div className="space-y-1.5">
            <Label>
              Angle <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="Steer the post — e.g. “focus on supply-chain security”"
              rows={3}
            />
          </div>

          <Button onClick={handleGenerate} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
