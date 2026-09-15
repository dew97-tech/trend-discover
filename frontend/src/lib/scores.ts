export type ScoreTier = 'high' | 'medium' | 'low'

export function scoreTier(score: number): ScoreTier {
  if (score >= 75) return 'high'
  if (score >= 55) return 'medium'
  return 'low'
}

export const SCORE_TIER_CLASS: Record<ScoreTier, string> = {
  high: 'bg-success-soft text-success',
  medium: 'bg-warning-soft text-warning',
  low: 'bg-score-low-soft text-score-low',
}

export const SCORE_HELP: Record<string, string> = {
  trend: 'Overall ranking score (freshness, buzz, practical value, originality, focus, overexposure).',
  freshness: 'How recently the story surfaced — fades over ~1.5 days per halving.',
  momentum: 'Buzz: engagement per hour since the story was first seen.',
  relevance: 'How well the story matches your technology and category list.',
  usefulness: 'Practical engineering value — tip/how-to phrasing gets a boost.',
  focus: 'Alignment with your focus topics (Laravel, PHP/TS, React, Next.js, databases).',
  novelty: 'Originality: how fresh and under-covered the story is — high means it is not everywhere yet.',
  saturation: 'Overexposure: how much this topic is already being discussed across sources.',
}

/** User-facing names for score dimensions (keys match the API). */
export const SCORE_LABELS: Record<string, string> = {
  freshness: 'Freshness',
  momentum: 'Buzz',
  relevance: 'Topic match',
  usefulness: 'Practical value',
  focus: 'Focus match',
  novelty: 'Originality',
  saturation: 'Overexposure',
}
