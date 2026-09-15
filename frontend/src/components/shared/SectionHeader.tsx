import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  /** Inline help rendered next to the title. */
  help?: ReactNode
  /** Right-aligned link or action. */
  actions?: ReactNode
}

export function SectionHeader({ title, description, help, actions }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          {title}
          {help}
        </h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
