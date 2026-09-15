import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { HelpTip } from '@/components/shared/HelpTip'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  htmlFor?: string
  /** Tooltip copy explaining what the control affects. */
  help?: string
  /** Small hint under the control (counts, limits). */
  hint?: ReactNode
  /** Right-aligned control in the label row (e.g. a "Suggest improvement" button). */
  action?: ReactNode
  className?: string
  children: ReactNode
}

/** Label + help + control + hint — the standard form field wrapper. */
export function Field({ label, htmlFor, help, hint, action, className, children }: Props) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {help ? <HelpTip text={help} /> : null}
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}
