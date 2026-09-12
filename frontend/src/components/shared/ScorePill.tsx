import { SCORE_TIER_CLASS, scoreTier } from '@/lib/scores'
import { cn } from '@/lib/utils'

interface Props {
  score: number
  className?: string
  /** Show the raw score instead of rounding (e.g. 75.35). */
  precise?: boolean
}

/** Compact tier-colored score chip used across trends, studio and overview. */
export function ScorePill({ score, className, precise = false }: Props) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums',
        SCORE_TIER_CLASS[scoreTier(score)],
        className,
      )}
    >
      {precise ? score : Math.round(score)}
    </span>
  )
}
