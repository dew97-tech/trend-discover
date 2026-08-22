import { api } from '@/lib/api'

export interface SourceRow {
  id: number
  name: string
  type: string
  is_enabled: boolean
  items_count: number
}

export function fetchSources(): Promise<SourceRow[]> {
  return api<{ data: SourceRow[] }>('/sources').then(({ data }) => data)
}
