export { scoreTier, type ScoreTier } from '@/lib/scores'

export interface TrendScores {
  trend: number
  novelty: number
  freshness: number
  momentum: number
  relevance: number
  usefulness: number
  focus?: number
  saturation: number
}

export interface Trend {
  id: number
  title: string
  summary?: string | null
  status: string
  workflow_status: 'draft' | 'ready' | 'posted'
  workflow_status_label?: string
  category?: { id: number; name: string; slug: string } | null
  technologies?: Array<{ id: number; name: string; slug: string }>
  scores: TrendScores
  hack_style?: boolean
  item_count: number
  has_post?: boolean | null
  first_seen_at: string | null
  last_seen_at: string | null
}
