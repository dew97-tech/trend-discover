import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  className?: string
}

/** Horizontal filter/action row used above lists and grids. */
export function Toolbar({ children, className }: Props) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
  )
}
