import { useState, type ReactNode } from 'react'
import {
  ChatCircleIcon,
  GlobeIcon,
  PaperPlaneTiltIcon,
  RepeatIcon,
  ThumbsUpIcon,
} from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  LINKEDIN_FOLD,
  parsePostBody,
  postStats,
  type PostBlock,
} from '@/lib/post-format'

interface Props {
  hook: string
  body: string
  hashtags: string[]
  includeHashtags: boolean
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0

    if (index > lastIndex) nodes.push(text.slice(lastIndex, index))

    const token = match[0]

    if (token.startsWith('**')) {
      nodes.push(
        <strong key={index} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={index} className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[0.9em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      nodes.push(
        <a
          key={index}
          href={link?.[2] ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="text-signal hover:underline"
        >
          {link?.[1] ?? token}
        </a>,
      )
    } else {
      nodes.push(<em key={index}>{token.slice(1, -1)}</em>)
    }

    lastIndex = index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

  return nodes
}

function Block({ block }: { block: PostBlock }) {
  if (block.type === 'code') {
    return (
      <div className="relative overflow-hidden rounded-md border border-code-border bg-code">
        {block.lang ? (
          <span className="absolute top-2 right-2 rounded-sm bg-white/10 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-white/50 uppercase">
            {block.lang}
          </span>
        ) : null}
        <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed text-code-foreground">
          {block.lines.join('\n')}
        </pre>
      </div>
    )
  }

  if (block.type === 'list') {
    return (
      <ul className="space-y-1">
        {block.items.map((item, index) => {
          const emojiLed = /^\p{Extended_Pictographic}/u.test(item)

          return (
            <li key={index} className="flex gap-2 leading-relaxed">
              {!emojiLed ? <span className="text-muted-foreground">•</span> : null}
              <span className="whitespace-pre-line">{renderInline(item)}</span>
            </li>
          )
        })}
      </ul>
    )
  }

  return <p className="whitespace-pre-line leading-relaxed">{renderInline(block.text)}</p>
}

/**
 * LinkedIn-style reading preview for a post body. The Rich view renders
 * sections/code/bullets; the Raw view shows exactly what gets copied.
 */
export function PostBodyPreview({ hook, body, hashtags, includeHashtags }: Props) {
  const [raw, setRaw] = useState(false)
  const full = [hook.trim(), body.trim()].filter(Boolean).join('\n\n')
  const blocks = parsePostBody(body)
  const stats = postStats(full)
  const foldAfterHook = stats.hook.length > 120 && stats.characters > LINKEDIN_FOLD

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Raw text (what gets copied)
          <Switch checked={raw} onCheckedChange={setRaw} className="scale-75" />
        </label>
      </div>

      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-surface p-5">
        {/* Post chrome */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-signal-soft text-xs font-semibold text-signal">
            You
          </span>
          <div className="text-xs">
            <p className="font-medium">Your name</p>
            <p className="flex items-center gap-1 text-muted-foreground">
              Software Engineer · now · <GlobeIcon className="size-3" />
            </p>
          </div>
        </div>

        {raw ? (
          <div className="whitespace-pre-wrap pt-3 font-sans text-[15px] leading-relaxed">
            {full}
          </div>
        ) : (
          <div className="space-y-3 pt-3 text-[15px]">
            {hook.trim() !== '' ? (
              <p className="whitespace-pre-line leading-relaxed">{renderInline(hook.trim())}</p>
            ) : null}

            {blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}

            {foldAfterHook ? (
              <p className="border-y border-dashed border-border-strong py-1.5 text-center text-[11px] text-muted-foreground">
                “see more” fold after ~{LINKEDIN_FOLD} characters
              </p>
            ) : null}
          </div>
        )}

        {includeHashtags && hashtags.length > 0 ? (
          <p className="pt-3 font-mono text-sm text-signal">
            {hashtags.map((tag) => `#${tag}`).join(' ')}
          </p>
        ) : null}

        {/* Engagement bar — visual completeness only */}
        <div className="mt-4 flex items-center gap-4 border-t border-border pt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <ThumbsUpIcon className="size-3" aria-hidden /> Like
          </span>
          <span className="flex items-center gap-1">
            <ChatCircleIcon className="size-3" aria-hidden /> Comment
          </span>
          <span className="flex items-center gap-1">
            <RepeatIcon className="size-3" aria-hidden /> Repost
          </span>
          <span className="flex items-center gap-1">
            <PaperPlaneTiltIcon className="size-3" aria-hidden /> Send
          </span>
          <span className={cn('ml-auto font-mono tabular-nums', stats.characters > 3000 && 'text-danger')}>
            {stats.characters} / 3000 characters · {stats.words} words · {stats.paragraphs} blocks
          </span>
        </div>
      </div>
    </div>
  )
}
