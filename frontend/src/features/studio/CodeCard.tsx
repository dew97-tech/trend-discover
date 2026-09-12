import { forwardRef, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shareable snippet card rendered as pure DOM so html-to-image can export it
 * to PNG locally (offline, free). Long code wraps instead of clipping, and
 * the type scale adapts to the longest line so the card always looks composed.
 */

export interface CodeCardSpec {
  code: string
  language: string
  title: string
}

export interface SnippetTheme {
  label: string
  /** Card background (solid or gradient). */
  background: string
  /** Code panel background. */
  panel: string
  /** Panel ring color. */
  ring: string
  /** Header/footer text color. */
  chrome: string
  /** Keyword accent for this theme. */
  keyword: string
}

const CODE_TEXT = '#e6edf3'
const CODE_STRING = '#a5d6ff'
const CODE_COMMENT = 'rgba(230, 237, 243, 0.38)'
const CODE_NUMBER = '#f2cc60'

export const SNIPPET_THEMES = {
  graphite: {
    label: 'Graphite',
    background: 'linear-gradient(135deg, #23272e, #0d0f12)',
    panel: '#0b0d10',
    ring: 'rgba(255, 255, 255, 0.08)',
    chrome: 'rgba(255, 255, 255, 0.55)',
    keyword: '#7ee787',
  },
  ink: {
    label: 'Ink',
    background: 'linear-gradient(135deg, #1a1c22, #08090b)',
    panel: '#0a0b0e',
    ring: 'rgba(255, 255, 255, 0.07)',
    chrome: 'rgba(255, 255, 255, 0.5)',
    keyword: '#c3a6ff',
  },
  slate: {
    label: 'Slate',
    background: 'linear-gradient(135deg, #2b3542, #141a21)',
    panel: '#10151b',
    ring: 'rgba(255, 255, 255, 0.08)',
    chrome: 'rgba(255, 255, 255, 0.55)',
    keyword: '#8ec7ff',
  },
  ocean: {
    label: 'Ocean',
    background: 'linear-gradient(135deg, #0c3d63, #061c2d)',
    panel: '#071a28',
    ring: 'rgba(255, 255, 255, 0.09)',
    chrome: 'rgba(255, 255, 255, 0.6)',
    keyword: '#79c0ff',
  },
  clay: {
    label: 'Clay',
    background: 'linear-gradient(135deg, #5c3024, #26120d)',
    panel: '#170b07',
    ring: 'rgba(255, 255, 255, 0.08)',
    chrome: 'rgba(255, 255, 255, 0.6)',
    keyword: '#ffb59e',
  },
} as const satisfies Record<string, SnippetTheme>

export type SnippetThemeKey = keyof typeof SNIPPET_THEMES

export const SNIPPET_THEME_KEYS = Object.keys(SNIPPET_THEMES) as SnippetThemeKey[]

const MAX_LINES = 16
const KEYWORDS =
  /\b(function|return|if|else|elseif|foreach|for|while|class|interface|trait|public|private|protected|static|const|let|var|new|import|from|export|default|async|await|try|catch|finally|throw|match|fn|use|namespace|echo|print|SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|GROUP|ORDER|BY|LIMIT|INDEX|CREATE|ALTER|DROP|TABLE|EXPLAIN|VACUUM|WITH|AS|ON|AND|OR|NOT|NULL|TRUE|FALSE|desc|asc)\b/gi

type TokenType = 'kw' | 'str' | 'com' | 'num' | 'plain'
interface Token {
  text: string
  type: TokenType
}

function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  const pattern =
    /(\/\/[^\n]*|#[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(code)) !== null) {
    if (match.index > lastIndex) {
      pushPlain(code.slice(lastIndex, match.index))
    }

    if (match[1]) tokens.push({ text: match[0], type: 'com' })
    else if (match[2]) tokens.push({ text: match[0], type: 'str' })
    else if (match[3]) tokens.push({ text: match[0], type: 'num' })

    lastIndex = pattern.lastIndex
  }

  function pushPlain(segment: string) {
    let pos = 0

    for (const m of segment.matchAll(KEYWORDS)) {
      const index = m.index ?? 0
      if (index > pos) tokens.push({ text: segment.slice(pos, index), type: 'plain' })
      tokens.push({ text: m[0], type: 'kw' })
      pos = index + m[0].length
    }

    if (pos < segment.length) tokens.push({ text: segment.slice(pos), type: 'plain' })
  }

  pushPlain(code.slice(lastIndex))

  return tokens
}

interface Props {
  spec: CodeCardSpec
  theme: SnippetThemeKey
  className?: string
}

export const CodeCard = forwardRef<HTMLDivElement, Props>(function CodeCard(
  { spec, theme, className },
  ref,
) {
  const t = SNIPPET_THEMES[theme]

  const lines = spec.code.split('\n')
  const maxLength = Math.max(1, ...lines.map((line) => line.length))
  const clipped = lines.length > MAX_LINES
  const visible = clipped
    ? [...lines.slice(0, MAX_LINES), '…']
    : lines
  const code = visible.join('\n')
  const tokens = tokenize(code)

  const fontSize = maxLength > 58 || visible.length > 14 ? 11 : maxLength > 40 ? 12 : 13

  const tokenStyle: Record<TokenType, CSSProperties> = {
    kw: { color: t.keyword },
    str: { color: CODE_STRING },
    com: { color: CODE_COMMENT, fontStyle: 'italic' },
    num: { color: CODE_NUMBER },
    plain: { color: CODE_TEXT },
  }

  return (
    <div
      ref={ref}
      style={{ background: t.background }}
      className={cn('flex w-full flex-col rounded-xl p-4', className)}
    >
      <div
        style={{ backgroundColor: t.panel, boxShadow: `inset 0 0 0 1px ${t.ring}` }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-4 py-2.5">
          <span
            style={{ color: t.chrome }}
            className="min-w-0 truncate text-xs font-medium"
          >
            {spec.title}
          </span>
          <span
            style={{ color: t.chrome }}
            className="ml-auto shrink-0 rounded-sm bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
          >
            {spec.language}
          </span>
        </div>

        <pre
          className="min-h-0 flex-1 overflow-hidden whitespace-pre-wrap break-words p-4 font-mono leading-relaxed"
          style={{ fontSize }}
        >
          <code>
            {tokens.map((token, i) => (
              <span key={i} style={tokenStyle[token.type]}>
                {token.text}
              </span>
            ))}
          </code>
        </pre>

        <div className="flex shrink-0 items-center justify-between border-t border-white/5 px-4 py-2.5">
          <span className="text-[10px] font-semibold tracking-wider text-white/40">
            TREND DISCOVER
          </span>
          <span className="text-[10px] text-white/25">
            {clipped ? `first ${MAX_LINES} of ${lines.length} lines` : `${visible.length} lines`}
          </span>
        </div>
      </div>
    </div>
  )
})
