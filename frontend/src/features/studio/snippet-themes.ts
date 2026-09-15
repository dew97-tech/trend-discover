/**
 * Snippet-card design tokens — "Signal Desk" export artifact.
 *
 * The card is designed at a fixed "1x" size and exported at 2x (pixelRatio 2)
 * so LinkedIn receives a 1200px-wide raster with ~28-30px code text — roughly
 * body-copy size once the feed scales it down.
 *
 * Deliberately flat: a single canvas color (never a gradient), the shared dark
 * code window, neutral window controls and a hairline ring instead of a drop
 * shadow. Code token colors are fixed so exports look identical regardless of
 * the app's light/dark theme.
 */

export interface SnippetTheme {
  label: string
  /** Flat canvas behind the window. */
  canvas: string
  /** Window body. */
  window: string
  /** Base code foreground — used by plain-text snippets and uncolored tokens. */
  code: string
  /** Window hairline ring. */
  ring: string
  /** Title bar text. */
  chrome: string
  /** Title-bar divider + badge fill. */
  chromeSoft: string
  /** Window controls — neutral to keep one accent per card. */
  dots: [string, string, string]
}

const NEUTRAL_DOTS: [string, string, string] = ['#c9d0d9', '#98a2b3', '#667085']
const WINDOW = '#0d1117'
const CODE_FG = '#e6edf3'

export const SNIPPET_THEMES = {
  paper: {
    label: 'Paper',
    canvas: '#eef1f5',
    window: WINDOW,
    code: CODE_FG,
    ring: 'rgba(21, 24, 29, 0.10)',
    chrome: 'rgba(255, 255, 255, 0.45)',
    chromeSoft: 'rgba(255, 255, 255, 0.08)',
    dots: NEUTRAL_DOTS,
  },
  signal: {
    label: 'Signal',
    canvas: '#e4effa',
    window: WINDOW,
    code: CODE_FG,
    ring: 'rgba(21, 24, 29, 0.10)',
    chrome: 'rgba(255, 255, 255, 0.45)',
    chromeSoft: 'rgba(255, 255, 255, 0.08)',
    dots: NEUTRAL_DOTS,
  },
  white: {
    label: 'White',
    canvas: '#ffffff',
    window: WINDOW,
    code: CODE_FG,
    ring: 'rgba(21, 24, 29, 0.10)',
    chrome: 'rgba(255, 255, 255, 0.45)',
    chromeSoft: 'rgba(255, 255, 255, 0.08)',
    dots: NEUTRAL_DOTS,
  },
  ink: {
    label: 'Ink',
    canvas: '#15181d',
    window: WINDOW,
    code: CODE_FG,
    ring: 'rgba(255, 255, 255, 0.14)',
    chrome: 'rgba(255, 255, 255, 0.45)',
    chromeSoft: 'rgba(255, 255, 255, 0.08)',
    dots: NEUTRAL_DOTS,
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

/** Shiki theme used inside the window (dark, matching `--code`). */
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
