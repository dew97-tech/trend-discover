import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { contentFormatLabel } from '@/lib/content-formats'
import { cn } from '@/lib/utils'

interface Props {
  title?: string | null
  hook?: string | null
  format: string
  tone?: string | null
  status: string
  qualityScore?: number | null
  hashtagCount?: number
  metaLeft?: ReactNode
  /** Right-aligned meta (versions, dates). */
  metaRight?: ReactNode
  actions?: ReactNode
  onClick?: () => void
}

/**
 * Shared post card used by Studio list, Library grid and Overview sections.
 * `actions` renders in the header (e.g. status menu); `metaLeft`/`metaRight`
 * render in the footer meta row.
 */
export function PostCard({
  title,
  hook,
  format,
  tone,
  status,
  qualityScore,
  hashtagCount,
  metaLeft,
  metaRight,
  actions,
  onClick,
}: Props) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'border shadow-none transition-colors',
        onClick && 'cursor-pointer hover:border-primary/40',
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-normal">
              {contentFormatLabel(format)}
            </Badge>
            {tone ? (
              <span className="text-xs text-muted-foreground">{tone}</span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {actions}
            <StatusBadge status={status} />
          </div>
        </div>
        <p className="line-clamp-2 pt-1.5 text-sm font-medium leading-snug">
          {(hook ?? title ?? '(untitled)').trim()}
        </p>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          {metaLeft}
          {hashtagCount ? <span>{hashtagCount} tags</span> : null}
        </span>
        <span className="flex items-center gap-2">
          {metaRight}
          {qualityScore !== null && qualityScore !== undefined ? (
            <span>
              Quality{' '}
              <strong
                className={cn(
                  'tabular-nums',
                  qualityScore >= 80 && 'text-success',
                  qualityScore < 60 && 'text-danger',
                )}
              >
                {Math.round(qualityScore)}
              </strong>
            </span>
          ) : null}
        </span>
      </CardContent>
    </Card>
  )
}
