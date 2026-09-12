import { CircleHelp } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Props {
  /** Tooltip copy — keep to one or two short sentences. */
  text: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

/**
 * Inline help affordance for non-obvious labels, metrics and controls.
 * The app-level TooltipProvider supplies shared timing.
 */
export function HelpTip({ text, side = 'top', className }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="More information"
          className={cn(
            'inline-flex shrink-0 cursor-help text-muted-foreground/60 transition-colors hover:text-muted-foreground focus-visible:text-muted-foreground',
            className,
          )}
        >
          <CircleHelp className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="max-w-64 text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
