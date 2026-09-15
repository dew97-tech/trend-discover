/**
 * Single source of truth for LinkedIn post formats.
 * Values must match App\Enums\ContentFormat on the backend.
 */
export interface ContentFormatMeta {
  value: string
  label: string
  /** One-line guidance shown in pickers and tooltips. */
  description: string
}

export const CONTENT_FORMATS: ContentFormatMeta[] = [
  {
    value: 'quick_tip',
    label: 'Quick Tip',
    description: 'One concrete tip someone can apply today — code or config, no lecture.',
  },
  {
    value: 'laravel_hack',
    label: 'Laravel Tip',
    description: 'A specific Laravel/Artisan/Eloquent technique with the exact code.',
  },
  {
    value: 'sql_hack',
    label: 'SQL Tip',
    description: 'A database technique — indexing, EXPLAIN, N+1 — with before/after queries.',
  },
  {
    value: 'react_hack',
    label: 'React Tip',
    description: 'A specific React technique (hooks, rendering, state) with a minimal example.',
  },
  {
    value: 'nextjs_hack',
    label: 'Next.js Tip',
    description: 'A Next.js technique — App Router, caching, ISR — and the gotcha it fixes.',
  },
  {
    value: 'technical_insight',
    label: 'Technical Insight',
    description: 'One non-obvious technical truth with concrete specifics.',
  },
  {
    value: 'optimization_tip',
    label: 'Optimization Tip',
    description: 'One actionable optimization and the measurable effect it had.',
  },
  {
    value: 'problem_solution',
    label: 'Problem → Solution',
    description: 'Start from a real symptom and walk to the fix in a few steps.',
  },
  {
    value: 'before_after',
    label: 'Before → After',
    description: 'Lead with the pain, then the improvement.',
  },
  {
    value: 'engineering_lesson',
    label: 'Engineering Lesson',
    description: 'What a specific incident taught you about engineering practice.',
  },
  {
    value: 'release_highlight',
    label: 'Release Highlight',
    description: 'What changed, who should care, and the migration gotcha.',
  },
  {
    value: 'tool_discovery',
    label: 'Tool Discovery',
    description: 'The problem it solves, when not to use it, first-run impression.',
  },
  {
    value: 'performance_breakdown',
    label: 'Performance Breakdown',
    description: 'Walk the measurement path; show where time actually went.',
  },
  {
    value: 'architecture_insight',
    label: 'Architecture Insight',
    description: 'Why a design holds under load — trade-offs included.',
  },
  {
    value: 'debugging_story',
    label: 'Debugging Story',
    description: 'Symptom to root cause, including the wrong hypotheses.',
  },
  {
    value: 'developer_debate',
    label: 'Developer Debate',
    description: 'Steel-man both sides, then state your position.',
  },
  {
    value: 'case_study',
    label: 'Case Study',
    description: 'Real system, real constraint, what was decided and why.',
  },
]

export const FORMAT_BY_VALUE = new Map(CONTENT_FORMATS.map((f) => [f.value, f]))

export function contentFormatLabel(value: string): string {
  return FORMAT_BY_VALUE.get(value)?.label ?? value.replaceAll('_', ' ')
}

export function contentFormatDescription(value: string): string {
  return FORMAT_BY_VALUE.get(value)?.description ?? 'A focused technical take.'
}
