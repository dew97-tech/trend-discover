/**
 * Post lifecycle display metadata — label + badge classes per status.
 * Values must match App\Enums\PostStatus on the backend.
 */
export interface PostStatusMeta {
  value: string
  label: string
  /** Badge surface classes (soft background + readable text). */
  className: string
  /** Short explanation shown in tooltips. */
  description: string
}

export const POST_STATUS_META: Record<string, PostStatusMeta> = {
  draft: {
    value: 'draft',
    label: 'Draft',
    className: 'bg-surface-muted text-muted-foreground',
    description: 'Quality score below 60 — needs edits before posting.',
  },
  review: {
    value: 'review',
    label: 'Needs review',
    className: 'bg-warning-soft text-warning',
    description: 'Quality score 60–79 — read it once before posting.',
  },
  ready: {
    value: 'ready',
    label: 'Ready to post',
    className: 'bg-success-soft text-success',
    description: 'Quality score 80+ — ready to copy into LinkedIn.',
  },
  published: {
    value: 'published',
    label: 'Posted',
    className: 'bg-info-soft text-info',
    description: 'Marked as posted on LinkedIn.',
  },
  archived: {
    value: 'archived',
    label: 'Archived',
    className: 'bg-secondary text-muted-foreground',
    description: 'Kept for reference but out of the active list.',
  },
  failed_generation: {
    value: 'failed_generation',
    label: 'Generation failed',
    className: 'bg-danger-soft text-danger',
    description: 'The AI call failed — generate the post again.',
  },
  failed_validation: {
    value: 'failed_validation',
    label: 'Auto-check failed',
    className: 'bg-danger-soft text-danger',
    description: 'The draft failed the automatic checks.',
  },
}

export function postStatusMeta(status: string): PostStatusMeta {
  return (
    POST_STATUS_META[status] ?? {
      value: status,
      label: status.replaceAll('_', ' '),
      className: 'bg-surface-muted text-muted-foreground',
      description: '',
    }
  )
}

/** Lifecycle actions available from the Library/Studio menus. */
export const POST_STATUS_ACTIONS: Array<{ status: string; label: string }> = [
  { status: 'review', label: 'Mark for review' },
  { status: 'ready', label: 'Mark ready' },
  { status: 'archived', label: 'Archive' },
]
