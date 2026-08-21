import { api } from '@/lib/api'
import type { Trend } from './types'

export interface TrendFilters {
  search?: string
  category_id?: string
  technology_id?: string
  status?: string
  min_trend_score?: string
  from?: string
}

export interface PaginatedTrends {
  data: Trend[]
  next_cursor: string | null
}

export function fetchTrends(filters: TrendFilters, cursor?: string | null): Promise<PaginatedTrends> {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })

  params.set('per_page', '12')

  if (cursor) params.set('cursor', cursor)

  return api<PaginatedTrends>(`/trends?${params.toString()}`)
}

export interface TrendDetail extends Trend {
  why_matters: string | null
  score_breakdown: Record<string, number> | null
  applied_weights: Record<string, number> | null
  sources: Array<{
    source: string | null
    title: string | null
    url: string | null
    metrics: Record<string, number>
    published_at: string | null
  }>
}

export function fetchTrend(id: number): Promise<TrendDetail> {
  return api<TrendDetail>(`/trends/${id}`)
}

export function rescoreTrend(id: number): Promise<{ message: string }> {
  return api(`/trends/${id}/rescore`, { method: 'POST' })
}

export interface Taxonomy {
  categories: Array<{ id: number; name: string; slug: string }>
  technologies: Array<{ id: number; name: string; slug: string; category_id: number | null }>
}

export function fetchTaxonomy(): Promise<Taxonomy> {
  return api<Taxonomy>('/taxonomy')
}
