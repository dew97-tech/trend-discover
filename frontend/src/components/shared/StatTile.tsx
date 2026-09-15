import { HelpTip } from '@/components/shared/HelpTip'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: number | string | null
  help?: string
  /** Optional context line under the value. */
  hint?: string
  className?: string
}

/**
 * Instrument-style metric readout: hairline rule, micro label, mono value.
 * Deliberately not a card — metrics sit in the page grid, not in boxes.
 */
export function StatTile({ label, value, help, hint, className }: Props) {
  return (
    <div className={cn('border-t border-border pt-3', className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </span>
        {help ? <HelpTip text={help} /> : null}
      </div>
      <div className="mt-2">
        {value === null ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
        )}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
