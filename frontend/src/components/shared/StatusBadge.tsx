import { Badge } from '@/components/ui/badge'
import { postStatusMeta } from '@/lib/post-status'
import { cn } from '@/lib/utils'

interface Props {
  status: string
  className?: string
}

/** Post lifecycle badge driven by the shared post-status map. */
export function StatusBadge({ status, className }: Props) {
  const meta = postStatusMeta(status)

  return (
    <Badge
      variant="secondary"
      title={meta.description || undefined}
      className={cn(
        'border-transparent text-[10px] font-semibold tracking-[0.08em] uppercase',
        meta.className,
        className,
      )}
    >
      {meta.label}
    </Badge>
  )
}
