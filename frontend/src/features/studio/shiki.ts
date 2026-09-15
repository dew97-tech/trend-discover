import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { CODE_THEME } from './snippet-themes'

/**
 * Lazy Shiki instance: the wasm-free core boots only when the Visuals tab
 * first needs highlighting, and each language grammar is a separate dynamic
 * import (code-split by Vite). Falls back to plain text on any failure.
 */

export interface CodeToken {
  text: string
  color?: string
  fontStyle?: number
}

const LANG_LOADERS: Record<string, () => Promise<unknown>> = {
  bash: () => import('@shikijs/langs/bash'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  css: () => import('@shikijs/langs/css'),
  dockerfile: () => import('@shikijs/langs/dockerfile'),
  go: () => import('@shikijs/langs/go'),
  html: () => import('@shikijs/langs/html'),
  java: () => import('@shikijs/langs/java'),
  javascript: () => import('@shikijs/langs/javascript'),
  json: () => import('@shikijs/langs/json'),
  jsx: () => import('@shikijs/langs/jsx'),
  php: () => import('@shikijs/langs/php'),
  python: () => import('@shikijs/langs/python'),
  rust: () => import('@shikijs/langs/rust'),
  sql: () => import('@shikijs/langs/sql'),
  tsx: () => import('@shikijs/langs/tsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  yaml: () => import('@shikijs/langs/yaml'),
}

const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  cs: 'csharp',
  'c++': 'cpp',
  docker: 'dockerfile',
}

export function normalizeLanguage(language: string): string {
  const lowered = language.trim().toLowerCase()
  const normalized = ALIASES[lowered] ?? lowered

  return normalized in LANG_LOADERS ? normalized : 'text'
}

let corePromise: Promise<HighlighterCore> | null = null
const languagePromises = new Map<string, Promise<void>>()

function getCore(): Promise<HighlighterCore> {
  corePromise ??= createHighlighterCore({
    themes: [import('@shikijs/themes/github-dark-default')],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  })

  return corePromise
}

async function ensureLanguage(core: HighlighterCore, language: string): Promise<void> {
  if (language === 'text') return

  const pending = languagePromises.get(language) ?? core.loadLanguage(LANG_LOADERS[language] as never)
  languagePromises.set(language, pending)
  await pending
}

export async function highlightCode(code: string, language: string): Promise<CodeToken[][]> {
  const lang = normalizeLanguage(language)

  try {
    const core = await getCore()
    await ensureLanguage(core, lang)

    const { tokens } = core.codeToTokens(code, {
      lang: lang === 'text' ? 'text' : lang,
      theme: CODE_THEME,
    })

    return tokens.map((line) =>
      line.map((token) => ({
        text: token.content,
        color: token.color,
        fontStyle: token.fontStyle,
      })),
    )
  } catch {
    // Offline/grammar failure: plain text is better than a blank card.
    return code.split('\n').map((line) => [{ text: line }])
  }
}
