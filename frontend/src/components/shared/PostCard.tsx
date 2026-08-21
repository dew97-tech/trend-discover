import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface-muted text-muted-foreground',
  review: 'bg-warning-soft text-warning',
  ready: 'bg-success-soft text-success',
  published: 'bg-info-soft text-info',
  archived: 'bg-secondary text-muted-foreground',
  failed_generation: 'bg-danger-soft text-danger',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  review: 'Review',
  ready: 'Ready',
  published: 'Published',
  archived: 'Archived',
  failed_generation: 'Failed',
}

interface Props {
  title?: string | null
  hook?: string | null
  format: string
  status: string
  qualityScore?: number | null
  metaLeft?: ReactNode
  actions?: ReactNode
  onClick?: () => void
}

/**
 * Shared post card used by Studio list, Library grid and Dashboard sections.
 * `actions` renders in the header (e.g. status menu); `metaLeft` under content.
 */
export function PostCard({
  title,
  hook,
  format,
  status,
  qualityScore,
  metaLeft,
  actions,
  onClick,
}: Props) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        onClick && 'cursor-pointer transition-shadow hover:shadow-md',
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="secondary" className="text-xs capitalize">
            {format.replaceAll('_', ' ')}
          </Badge>
          <div className="flex items-center gap-1.5">
            {actions}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                STATUS_STYLES[status] ?? 'bg-surface-muted',
              )}
            >
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>
        </div>
        <p className="line-clamp-2 pt-1 text-sm font-medium leading-snug">
          {(hook ?? title ?? '(untitled)').trim()}
        </p>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{metaLeft}</span>
        {qualityScore !== null && qualityScore !== undefined ? (
          <span>
            Quality{' '}
            <strong className={cn(qualityScore >= 80 && 'text-success', qualityScore < 60 && 'text-danger')}>
              {Math.round(qualityScore)}
            </strong>
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}
