import { api } from '@/lib/api'
import type { Trend } from './types'

export interface TrendFilters {
  search?: string
  category_id?: string
  technology_id?: string
  status?: string
  min_trend_score?: string
  focus?: string
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
  // Detail responses arrive as {data:{…}, score_breakdown, sources, …} —
  // flatten once so consumers read scores/sources off one level.
  return api<TrendDetail & { data: Trend }>(`/trends/${id}`).then(
    (res) => ({ ...res, ...res.data }),
  )
}

export function rescoreTrend(id: number): Promise<{ message: string }> {
  return api(`/trends/${id}/rescore`, { method: 'POST' })
}

export function deleteTrend(id: number): Promise<{ message: string }> {
  return api(`/trends/${id}`, { method: 'DELETE' })
}

export function runDetection(): Promise<{ message: string }> {
  return api('/pipeline/detect', { method: 'POST' })
}

export interface Taxonomy {
  categories: Array<{ id: number; name: string; slug: string }>
  technologies: Array<{ id: number; name: string; slug: string; category_id: number | null }>
}

export function fetchTaxonomy(): Promise<Taxonomy> {
  return api<Taxonomy>('/taxonomy')
}

// ── Post generation ────────────────────────────────────────────────

export interface GenerateSpec {
  format: string
  tone?: string
  angle?: string
}

export interface ContentPost {
  id: number
  trend_id: number
  trend?: { id: number; title: string } | null
  title: string | null
  hook: string | null
  body: string
  format: string
  tone: string
  angle?: string | null
  hashtags?: string[] | null
  status: string
  quality_score: number | null
  quality_breakdown: {
    dimensions?: Record<string, number>
    issues?: string[]
  } | null
  word_count: number | null
  version_count?: number
  generated_at: string | null
  updated_at?: string | null
}

export interface PostGroup {
  trend: {
    id: number
    title: string
    category: { id: number; name: string; slug: string } | null
    trend_score: number
    focus_score: number
    hack_style: boolean
    deleted: boolean
  }
  post_count: number
  latest_at: string | null
  posts: ContentPost[]
}

export interface GroupedPostsFilters {
  status?: string
  format?: string
  search?: string
}

/** Posts grouped under their trend — powers the Studio working view. */
export function fetchGroupedPosts(
  filters: GroupedPostsFilters = {},
  cursor?: string | null,
): Promise<{ data: PostGroup[]; next_cursor: string | null }> {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })

  params.set('per_page', '10')

  if (cursor) params.set('cursor', cursor)

  return api(`/posts/grouped?${params.toString()}`)
}

export function deletePost(id: number): Promise<{ message: string }> {
  return api(`/posts/${id}`, { method: 'DELETE' })
}

export function deleteTrendPosts(trendId: number): Promise<{ message: string; deleted: number }> {
  return api(`/posts?trend_id=${trendId}`, { method: 'DELETE' })
}

export function generatePost(trendId: number, spec: GenerateSpec): Promise<{ message: string }> {
  return api<{ message: string }>(`/trends/${trendId}/generate`, { method: 'POST', body: spec }).then((res) => {
    // Track so Studio keeps polling until the post actually lands
    // (real AI runs take 1.5–3+ minutes).
    try {
      const rest = getPendingGenerations().filter((e) => e.trendId !== trendId)
      localStorage.setItem(
        'td_pending_generations',
        JSON.stringify([...rest, { trendId, queuedAt: Date.now() }]),
      )
    } catch {
      // tracker is best-effort UX sugar — never block the queue call
    }
    return res
  })
}

export function getPendingGenerations(): Array<{ trendId: number; queuedAt: number }> {
  try {
    return (
      JSON.parse(localStorage.getItem('td_pending_generations') ?? '[]') as Array<{
        trendId: number
        queuedAt: number
      }>
    ).filter((e) => typeof e.trendId === 'number' && Date.now() - e.queuedAt < 10 * 60 * 1000)
  } catch {
    return []
  }
}

export function clearPendingGeneration(trendId: number): void {
  localStorage.setItem(
    'td_pending_generations',
    JSON.stringify(getPendingGenerations().filter((e) => e.trendId !== trendId)),
  )
}

export interface ContentPostFilters {
  status?: string
  format?: string
  trend_id?: string
  search?: string
  per_page?: string
  cursor?: string
}

export interface PaginatedPosts {
  data: ContentPost[]
  next_cursor: string | null
}

export function fetchPosts(filters: ContentPostFilters = {}): Promise<PaginatedPosts> {
  const params = new URLSearchParams()
  const { per_page, cursor, ...rest } = filters

  Object.entries(rest).forEach(([key, value]) => {
    if (value) params.set(`filter[${key}]`, value)
  })

  params.set('per_page', per_page ?? '12')

  if (cursor) params.set('cursor', cursor)

  return api<PaginatedPosts>(`/posts?${params.toString()}`)
}

export function fetchPost(id: number): Promise<{ data: ContentPost }> {
  return api(`/posts/${id}`)
}

export function patchPost(
  id: number,
  changes: { title?: string; hook?: string; body: string; hashtags?: string[] },
): Promise<{ data: ContentPost }> {
  return api(`/posts/${id}`, { method: 'PATCH', body: changes })
}

export function regeneratePost(id: number): Promise<{ message: string }> {
  return api(`/posts/${id}/regenerate`, { method: 'POST' })
}

/** Queues AI hashtag selection for a post (async — poll the post afterwards). */
export function generatePostHashtags(id: number): Promise<{ message: string }> {
  return api(`/posts/${id}/hashtags`, { method: 'POST' })
}
