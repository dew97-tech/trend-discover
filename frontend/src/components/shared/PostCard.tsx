import type { KeyboardEvent, ReactNode } from 'react'
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
 * render in the footer meta row. When `onClick` is set the card becomes a
 * keyboard-operable button.
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
  const headline = (hook ?? title ?? '(untitled)').trim()
  const interactive = Boolean(onClick)

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onClick?.()
  }

  return (
    <Card
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? headline : undefined}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
      className={cn(
        'gap-3 transition-colors duration-150',
        interactive &&
          'cursor-pointer hover:border-signal/50 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[10px] tracking-wide">
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
          {headline}
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
                  'font-mono tabular-nums',
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
