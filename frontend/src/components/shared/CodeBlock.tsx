import { cn } from '@/lib/utils'

interface Props {
  code: string
  label?: string
  /** Tailwind max-height class, e.g. "max-h-72". */
  maxHeightClass?: string
  className?: string
}

/** Read-only monospace block for logs and snippets that should wrap, never clip. */
export function CodeBlock({ code, label, maxHeightClass = 'max-h-72', className }: Props) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-surface-sunken', className)}>
      {label ? (
        <div className="border-b border-border px-3 py-1.5 font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </div>
      ) : null}
      <pre
        className={cn(
          'overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed',
          maxHeightClass,
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}
