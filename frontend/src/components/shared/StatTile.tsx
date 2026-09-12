import type { LucideIcon } from 'lucide-react'
import { HelpTip } from '@/components/shared/HelpTip'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: number | string | null
  icon?: LucideIcon
  help?: string
  /** Optional context line under the value. */
  hint?: string
  className?: string
}

export function StatTile({ label, value, icon: Icon, help, hint, className }: Props) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon className="size-3.5" /> : null}
        <span>{label}</span>
        {help ? <HelpTip text={help} /> : null}
      </div>
      <div className="mt-2">
        {value === null ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        )}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
