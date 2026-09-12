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
    description: 'Quality gate scored it below 60 — needs edits before publishing.',
  },
  review: {
    value: 'review',
    label: 'Review',
    className: 'bg-warning-soft text-warning',
    description: 'Quality gate scored 60–79 — read it once before publishing.',
  },
  ready: {
    value: 'ready',
    label: 'Ready',
    className: 'bg-success-soft text-success',
    description: 'Quality gate scored 80+ — ready to copy into LinkedIn.',
  },
  published: {
    value: 'published',
    label: 'Published',
    className: 'bg-info-soft text-info',
    description: 'Marked as published on LinkedIn.',
  },
  archived: {
    value: 'archived',
    label: 'Archived',
    className: 'bg-secondary text-muted-foreground',
    description: 'Kept for reference but out of the active queue.',
  },
  failed_generation: {
    value: 'failed_generation',
    label: 'Generation failed',
    className: 'bg-danger-soft text-danger',
    description: 'The AI call failed — regenerate the post.',
  },
  failed_validation: {
    value: 'failed_validation',
    label: 'Validation failed',
    className: 'bg-danger-soft text-danger',
    description: 'The draft failed deterministic checks.',
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
  { status: 'review', label: 'Move to Review' },
  { status: 'ready', label: 'Mark Ready' },
  { status: 'archived', label: 'Archive' },
]
