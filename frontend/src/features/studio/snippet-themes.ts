/**
 * ray.so-style snippet-card design tokens.
 *
 * The card is designed at a fixed "1x" size and exported at 2x (pixelRatio 2)
 * so LinkedIn receives a 1200px-wide raster with ~28-30px code text — roughly
 * body-copy size once the feed scales it down.
 */

export interface SnippetTheme {
  label: string
  /** Canvas gradient behind the window. */
  background: string
  /** Window body. */
  window: string
  /** Window ring + shadow. */
  ring: string
  shadow: string
  /** Title bar text. */
  chrome: string
  /** Traffic lights: [close, minimize, maximize]. */
  dots: [string, string, string]
}

export const SNIPPET_THEMES = {
  purple: {
    label: 'Purple',
    background: 'linear-gradient(135deg, #c9b8fd 0%, #9b7cf6 45%, #6d28d9 100%)',
    window: '#0a0a0a',
    ring: 'rgba(255, 255, 255, 0.10)',
    shadow: '0 32px 64px rgba(24, 10, 64, 0.45)',
    chrome: 'rgba(255, 255, 255, 0.45)',
    dots: ['#ff5f57', '#febc2e', '#28c840'],
  },
  candy: {
    label: 'Candy',
    background: 'linear-gradient(135deg, #ffd6e0 0%, #ff8fab 48%, #fb6f92 100%)',
    window: '#0a0a0a',
    ring: 'rgba(255, 255, 255, 0.12)',
    shadow: '0 32px 64px rgba(96, 16, 44, 0.40)',
    chrome: 'rgba(255, 255, 255, 0.45)',
    dots: ['#ff5f57', '#febc2e', '#28c840'],
  },
  sunset: {
    label: 'Sunset',
    background: 'linear-gradient(135deg, #ffe1b0 0%, #ffa279 48%, #ef5560 100%)',
    window: '#0a0a0a',
    ring: 'rgba(255, 255, 255, 0.12)',
    shadow: '0 32px 64px rgba(110, 34, 12, 0.42)',
    chrome: 'rgba(255, 255, 255, 0.45)',
    dots: ['#ff5f57', '#febc2e', '#28c840'],
  },
  ocean: {
    label: 'Ocean',
    background: 'linear-gradient(135deg, #a5f3fc 0%, #38bdf8 50%, #2563eb 100%)',
    window: '#0a0a0a',
    ring: 'rgba(255, 255, 255, 0.12)',
    shadow: '0 32px 64px rgba(6, 46, 92, 0.45)',
    chrome: 'rgba(255, 255, 255, 0.45)',
    dots: ['#ff5f57', '#febc2e', '#28c840'],
  },
  forest: {
    label: 'Forest',
    background: 'linear-gradient(135deg, #bbf7d0 0%, #4ade80 50%, #15803d 100%)',
    window: '#0a0a0a',
    ring: 'rgba(255, 255, 255, 0.12)',
    shadow: '0 32px 64px rgba(8, 58, 26, 0.45)',
    chrome: 'rgba(255, 255, 255, 0.45)',
    dots: ['#ff5f57', '#febc2e', '#28c840'],
  },
  mono: {
    label: 'Mono',
    background: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 55%, #8fa3b8 100%)',
    window: '#0a0a0a',
    ring: 'rgba(255, 255, 255, 0.12)',
    shadow: '0 32px 64px rgba(15, 23, 42, 0.35)',
    chrome: 'rgba(255, 255, 255, 0.45)',
    dots: ['#ff5f57', '#febc2e', '#28c840'],
  },
} as const satisfies Record<string, SnippetTheme>

export type SnippetThemeKey = keyof typeof SNIPPET_THEMES

export const SNIPPET_THEME_KEYS = Object.keys(SNIPPET_THEMES) as SnippetThemeKey[]

/** Fixed 1x card sizes; exported at 2x → 1200×1200 / 1200×628. */
export const CARD_1X = {
  square: { width: 600, height: 600 },
  landscape: { width: 600, height: 314 },
} as const

export type CardSizeKey = keyof typeof CARD_1X

export const EXPORT_SCALE = 2

export const EXPORT_SIZES: Record<CardSizeKey, { label: string }> = {
  square: { label: 'Square · 1200×1200' },
  landscape: { label: 'Landscape · 1200×628' },
}

export const CODE = {
  /** Never shrink below this at 1x — readability beats fitting on one line. */
  minFontSize: 13,
  baseFontSize: 15,
  lineHeight: 1.65,
  maxLines: 16,
  /** Longest-line thresholds that step the font down (1x chars). */
  mediumLine: 46,
  longLine: 58,
} as const

/** Title-bar height at 1x (traffic lights row + border). */
export const CHROME_HEIGHT = 46

/** Code block vertical padding at 1x (py-5 ×2). */
export const CODE_PADDING_Y = 40

export const CANVAS_PADDING = {
  min: 24,
  max: 72,
  default: 40,
} as const

/** Shiki theme used inside the window (ray.so's editor look). */
export const CODE_THEME = 'github-dark-default'

export interface FitResult {
  fontSize: number
  lines: string[]
  hiddenLines: number
}

/**
 * Height-aware typography. Finds the largest font (base 15 → floor 13) that
 * fits the visible rows, reserving one row for the "N more lines" hint when
 * the snippet is clipped; prefers showing everything over a bigger font.
 */
export function fitCode(
  code: string,
  availableHeight: number,
  maxLines: number = CODE.maxLines,
): FitResult {
  const allLines = code.replace(/\t/g, '  ').split('\n')
  const longest = Math.max(1, ...allLines.map((line) => line.length))

  const preferred = Math.max(
    CODE.minFontSize,
    CODE.baseFontSize - (longest > CODE.mediumLine ? 1 : 0) - (longest > CODE.longLine ? 1 : 0),
  )

  const capped = allLines.length > maxLines
  // Rows the card must fit: code lines + the ellipsis hint row when capped.
  const rowsNeeded = capped ? maxLines : allLines.length

  for (let fontSize = preferred; fontSize >= CODE.minFontSize; fontSize -= 1) {
    const capacity = Math.floor(availableHeight / (fontSize * CODE.lineHeight))

    if (capacity < rowsNeeded) continue

    if (!capped) {
      return { fontSize, lines: allLines, hiddenLines: 0 }
    }

    const shown = maxLines - 1

    return {
      fontSize,
      lines: allLines.slice(0, shown),
      hiddenLines: allLines.length - shown,
    }
  }

  // Floor reached: fit what we can, reserving the ellipsis row.
  const capacity = Math.max(2, Math.floor(availableHeight / (CODE.minFontSize * CODE.lineHeight)))
  const shown = Math.min(capacity - 1, maxLines - 1, allLines.length)

  return {
    fontSize: CODE.minFontSize,
    lines: allLines.slice(0, shown),
    hiddenLines: allLines.length - shown,
  }
}
