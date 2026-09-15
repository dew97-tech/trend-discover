/**
 * Lightweight block parser for AI-written LinkedIn post bodies.
 *
 * The copy path always uses the raw text — this parser only feeds the
 * human-readable Preview tab so sections, code and bullets don't read as a
 * wall of text.
 */

export type PostBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'code'; lang: string | null; lines: string[] }
  | { type: 'list'; items: string[] }

const LIST_PATTERN = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/
const EMOJI_BULLET_PATTERN = /^\s*\p{Extended_Pictographic}\uFE0F?\s+.*$/u
const FENCE_PATTERN = /^\s*```(.*)$/

export function parsePostBody(body: string): PostBlock[] {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const blocks: PostBlock[] = []

  let paragraph: string[] = []
  let code: { lang: string | null; lines: string[] } | null = null
  let list: string[] = []

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join('\n').trim() })
      paragraph = []
    }
  }

  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ type: 'list', items: list })
      list = []
    }
  }

  for (const line of lines) {
    const fence = line.match(FENCE_PATTERN)

    if (fence) {
      if (code === null) {
        flushParagraph()
        flushList()
        code = { lang: fence[1].trim() || null, lines: [] }
      } else {
        blocks.push({ type: 'code', lang: code.lang, lines: code.lines })
        code = null
      }

      continue
    }

    if (code !== null) {
      code.lines.push(line)

      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      flushList()

      continue
    }

    const item = line.match(LIST_PATTERN)

    if (item) {
      flushParagraph()
      list.push(item[1])

      continue
    }

    // Emoji-led lines are bullets in the house style — keep the emoji as the
    // marker instead of stripping it.
    if (EMOJI_BULLET_PATTERN.test(line)) {
      flushParagraph()
      list.push(line.trim())

      continue
    }

    flushList()
    paragraph.push(line)
  }

  // Unclosed constructs still render.
  if (code !== null) {
    blocks.push({ type: 'code', lang: code.lang, lines: code.lines })
  }

  flushParagraph()
  flushList()

  return blocks.filter((block) => block.type !== 'paragraph' || block.text !== '')
}

export interface PostStats {
  characters: number
  words: number
  paragraphs: number
  hook: string
}

export function postStats(body: string): PostStats {
  const blocks = parsePostBody(body)
  const hook = body.replace(/\r\n?/g, '\n').split('\n').find((line) => line.trim() !== '') ?? ''

  return {
    characters: body.length,
    words: body.trim() === '' ? 0 : body.trim().split(/\s+/).length,
    paragraphs: blocks.filter((b) => b.type === 'paragraph').length,
    hook: hook.trim(),
  }
}

/** LinkedIn folds long posts after roughly 210 characters. */
export const LINKEDIN_FOLD = 210
