import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/**
 * Product mark: an ink tile carrying an ascending signal line with a live dot.
 * Grounded in the product — trend detection, not a generic letterform.
 */
export function BrandMark({ className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
        <path
          d="M4 16.5 9 11l3.5 3L19 6.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="19" cy="6.5" r="2.6" fill="#0a66c2" />
      </svg>
    </span>
  )
}
