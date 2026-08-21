export interface TrendScores {
  trend: number
  novelty: number
  freshness: number
  momentum: number
  relevance: number
  usefulness: number
  saturation: number
}

export interface Trend {
  id: number
  title: string
  summary?: string | null
  status: string
  category?: { id: number; name: string; slug: string } | null
  technologies?: Array<{ id: number; name: string; slug: string }>
  scores: TrendScores
  item_count: number
  has_post?: boolean
  first_seen_at: string | null
  last_seen_at: string | null
}

export function scoreTier(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) return 'high'
  if (score >= 55) return 'medium'
  return 'low'
}
