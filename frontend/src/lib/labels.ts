/**
 * Shared user-facing labels. Keep terminology in one place so renames are a
 * single edit — screens should read labels from here, not inline strings.
 */

export interface WorkflowStatusMeta {
  value: 'draft' | 'ready' | 'posted'
  label: string
  className: string
  description: string
}

/** Manual trend workflow state (App\Enums\TrendWorkflowStatus). */
export const TREND_WORKFLOW_STATUS: Record<string, WorkflowStatusMeta> = {
  draft: {
    value: 'draft',
    label: 'Draft',
    className: 'bg-surface-muted text-muted-foreground',
    description: 'Not reviewed yet — a candidate to look at.',
  },
  ready: {
    value: 'ready',
    label: 'Ready',
    className: 'bg-success-soft text-success',
    description: 'Worth turning into a post.',
  },
  posted: {
    value: 'posted',
    label: 'Posted',
    className: 'bg-info-soft text-info',
    description: 'A post from this trend was published — no longer suggested.',
  },
}

export const TREND_WORKFLOW_STATUS_KEYS = ['draft', 'ready', 'posted'] as const

export function trendWorkflowMeta(status?: string | null): WorkflowStatusMeta {
  return TREND_WORKFLOW_STATUS[status ?? 'draft'] ?? TREND_WORKFLOW_STATUS.draft
}
