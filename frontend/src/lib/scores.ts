export type ScoreTier = 'high' | 'medium' | 'low'

export function scoreTier(score: number): ScoreTier {
  if (score >= 75) return 'high'
  if (score >= 55) return 'medium'
  return 'low'
}

export const SCORE_TIER_CLASS: Record<ScoreTier, string> = {
  high: 'bg-success-soft text-success',
  medium: 'bg-warning-soft text-warning',
  low: 'bg-surface-muted text-muted-foreground',
}

export const SCORE_HELP: Record<string, string> = {
  trend: 'Composite ranking score (freshness, momentum, usefulness, novelty, focus, saturation).',
  freshness: 'How recently the story surfaced — decays over ~1.5 days per halving.',
  momentum: 'Engagement speed (points/comments per hour since first seen).',
  relevance: 'Match strength against the technology & category registry.',
  usefulness: 'Practical engineering value — hack/tip phrasing gets a boost.',
  focus: 'Alignment with your focus topics (Laravel, PHP/TS, React, Next.js, databases).',
  novelty: 'How fresh and under-covered the story is — high means not everywhere yet.',
  saturation: 'How much the topic is already being discussed across sources.',
}
