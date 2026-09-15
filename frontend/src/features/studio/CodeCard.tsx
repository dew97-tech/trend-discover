import { forwardRef, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { highlightCode, type CodeToken } from './shiki'
import {
  CANVAS_PADDING,
  CHROME_HEIGHT,
  CODE,
  CODE_PADDING_Y,
  fitCode,
  SNIPPET_THEMES,
  type SnippetThemeKey,
} from './snippet-themes'

/**
 * Shareable snippet card rendered as pure DOM so html-to-image can export it
 * to PNG locally (offline, free). Designed at a fixed 1x size, ray.so style:
 * gradient canvas → dark window with traffic lights → highlighted code.
 */

export interface CodeCardSpec {
  code: string
  language: string
  title: string
}

interface Props {
  spec: CodeCardSpec
  theme: SnippetThemeKey
  /** Canvas padding at 1x (default 40). */
  padding?: number
  /** Card height at 1x, used to fit the code to the export size. */
  cardHeight?: number
  showLineNumbers?: boolean
  className?: string
  /** Fires once syntax highlighting is applied — gate exports on it. */
  onHighlightReady?: () => void
}

function fontStyleFor(flags?: number): CSSProperties | undefined {
  if (!flags) return undefined

  const style: CSSProperties = {}

  if (flags & 1) style.fontStyle = 'italic'
  if (flags & 2) style.fontWeight = 700
  if (flags & 4) style.textDecoration = 'underline'

  return style
}

export const CodeCard = forwardRef<HTMLDivElement, Props>(function CodeCard(
  {
    spec,
    theme,
    padding = CANVAS_PADDING.default,
    cardHeight = 600,
    showLineNumbers = false,
    className,
    onHighlightReady,
  },
  ref,
) {
  const t = SNIPPET_THEMES[theme]
  const [tokens, setTokens] = useState<CodeToken[][] | null>(null)

  const availableHeight = Math.max(
    40,
    cardHeight - padding * 2 - CHROME_HEIGHT - CODE_PADDING_Y,
  )

  const { fontSize, lines, hiddenLines } = useMemo(
    () => fitCode(spec.code, availableHeight),
    [spec.code, availableHeight],
  )

  useEffect(() => {
    let cancelled = false

    setTokens(null)

    void highlightCode(spec.code, spec.language).then((result) => {
      if (cancelled) return

      // Keep only the visible lines so the card and the export agree.
      setTokens(result.slice(0, lines.length))
      onHighlightReady?.()
    })

    return () => {
      cancelled = true
    }
    // onHighlightReady is intentionally not a dependency — it is a stable callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.code, spec.language, lines.length])

  const roundedLines: CodeToken[][] = tokens ?? lines.map((line) => [{ text: line }])
  const visibleLines = roundedLines.slice(0, lines.length)
  const languageLabel = spec.language && spec.language !== 'other' ? spec.language : 'code'

  return (
    <div
      ref={ref}
      style={{ background: t.background, padding }}
      className={cn('flex items-center justify-center overflow-hidden', className)}
    >
      <div
        style={{
          backgroundColor: t.window,
          boxShadow: `0 0 0 1px ${t.ring}, ${t.shadow}`,
          borderRadius: 16,
        }}
        className="flex w-full flex-col overflow-hidden"
      >
        {/* Title bar */}
        <div
          className="flex shrink-0 items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
            {t.dots.map((color) => (
              <span
                key={color}
                className="inline-block rounded-full"
                style={{ width: 11, height: 11, backgroundColor: color }}
              />
            ))}
          </span>

          <span
            className="min-w-0 flex-1 truncate text-center text-[13px] font-medium"
            style={{ color: t.chrome }}
          >
            {spec.title}
          </span>

          <span
            className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{ color: t.chrome, backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            {languageLabel}
          </span>
        </div>

        {/* Code */}
        <pre
          className="overflow-hidden px-5 py-5 font-mono"
          style={{ fontSize, lineHeight: CODE.lineHeight, tabSize: 2 }}
        >
          <code>
            {visibleLines.map((lineTokens, index) => (
              <span key={index} className="flex">
                {showLineNumbers ? (
                  <span
                    className="mr-4 inline-block w-6 shrink-0 select-none text-right"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    {index + 1}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                  {lineTokens.map((token, tokenIndex) => (
                    <span
                      key={tokenIndex}
                      style={{ color: token.color, ...fontStyleFor(token.fontStyle) }}
                    >
                      {token.text}
                    </span>
                  ))}
                  {/* Keep empty lines from collapsing. */}
                  {lineTokens.length === 0 ? '\u00A0' : null}
                </span>
              </span>
            ))}
            {hiddenLines > 0 ? (
              <span className="flex">
                {showLineNumbers ? <span className="mr-4 inline-block w-6 shrink-0" /> : null}
                <span className="min-w-0 flex-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  … {hiddenLines} more lines
                </span>
              </span>
            ) : null}
          </code>
        </pre>
      </div>
    </div>
  )
})
