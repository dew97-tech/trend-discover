import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  /** Right-aligned actions (buttons, filters). */
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0 space-y-1.5">
        <h1 className="font-serif text-3xl leading-none font-medium tracking-tight">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
