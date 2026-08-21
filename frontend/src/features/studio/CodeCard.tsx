import { forwardRef } from 'react'

/**
 * ray.so-style shareable code card, rendered as pure DOM so
 * html-to-image can export it to PNG locally (offline, free).
 */

export interface CodeCardSpec {
  code: string
  language: string
  title: string
}

const GRADIENTS = {
  science: ['#0a66c2', '#004182'],
  midnight: ['#141e30', '#243b55'],
  terracotta: ['#b24020', '#915907'],
  forest: ['#44712e', '#1f3d17'],
  slate: ['#38434f', '#232b33'],
} as const

export type GradientKey = keyof typeof GRADIENTS

export const GRADIENT_KEYS = Object.keys(GRADIENTS) as GradientKey[]

const KEYWORDS =
  /\b(function|return|if|else|foreach|for|while|class|public|private|protected|static|const|let|var|new|import|from|export|async|await|try|catch|throw|match|fn|use|namespace|echo|SELECT|FROM|WHERE|JOIN|GROUP|ORDER|BY|INDEX|CREATE|ALTER|TABLE)\b/g

/** Minimal regex highlighter — good enough for share cards. */
function highlight(code: string): Array<{ text: string; type: 'kw' | 'str' | 'com' | 'num' | 'plain' }> {
  const tokens: Array<{ text: string; type: 'kw' | 'str' | 'com' | 'num' | 'plain' }> = []

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
      if ((m.index ?? 0) > pos) {
        tokens.push({ text: segment.slice(pos, m.index), type: 'plain' })
      }
      tokens.push({ text: m[0], type: 'kw' })
      pos = (m.index ?? 0) + m[0].length
    }
    if (pos < segment.length) tokens.push({ text: segment.slice(pos), type: 'plain' })
  }

  pushPlain(code.slice(lastIndex))
  return tokens
}

interface Props {
  spec: CodeCardSpec
  gradient: GradientKey
  dark?: boolean
}

export const CodeCard = forwardRef<HTMLDivElement, Props>(function CodeCard(
  { spec, gradient, dark = true },
  ref,
) {
  const [from, to] = GRADIENTS[gradient]
  const tokens = highlight(spec.code)

  return (
    <div
      ref={ref}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      className="rounded-xl p-5 shadow-xl"
    >
      <div className="overflow-hidden rounded-lg bg-[#161b22] ring-1 ring-white/10">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
          <span className="ml-2 text-xs text-white/60">{spec.title}</span>
          <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/40">
            {spec.language}
          </span>
        </div>
        <pre className="max-h-80 overflow-hidden p-5 font-mono text-[13px] leading-relaxed">
          <code>
            {tokens.map((token, i) => (
              <span
                key={i}
                className={
                  token.type === 'kw'
                    ? 'text-[#7ee787]'
                    : token.type === 'str'
                      ? 'text-[#a5d6ff]'
                      : token.type === 'com'
                        ? 'italic text-white/35'
                        : token.type === 'num'
                          ? 'text-[#f2cc60]'
                          : dark
                            ? 'text-[#e6edf3]'
                            : 'text-slate-800'
                }
              >
                {token.text}
              </span>
            ))}
          </code>
        </pre>
      </div>
      <p className="mt-3 text-center text-xs font-medium tracking-wide text-white/50">
        Trend Discover
      </p>
    </div>
  )
})
