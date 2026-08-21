import { useCallback, useEffect, useMemo, useState } from 'react'
import { Library as LibraryIcon, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PostCard } from '@/components/shared/PostCard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { fetchPosts, type ContentPost } from '../trends/api'
import { cn } from '@/lib/utils'

const TAB_FILTERS: Record<string, string> = {
  active: 'draft,review,ready',
  published: 'published',
  archived: 'archived',
  all: '',
}

export function LibraryPage() {
  const [posts, setPosts] = useState<ContentPost[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [tab, setTab] = useState('active')
  const [format, setFormat] = useState('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 350)
    return () => clearTimeout(timer)
  }, [search])

  const filters = useMemo(
    () => ({
      status: TAB_FILTERS[tab],
      format: format !== 'all' ? format : undefined,
      search: debounced || undefined,
    }),
    [tab, format, debounced],
  )

  const load = useCallback((cursor?: string | null) => {
    const isLoadMore = Boolean(cursor)

    if (isLoadMore) setLoadingMore(true)
    else setPosts(null)

    fetchPosts({ ...filters, ...(cursor ? { cursor } : {}) })
      .then((res) => {
        setPosts((prev) =>
          isLoadMore && prev ? [...prev, ...res.data] : res.data,
        )
        setNextCursor(res.next_cursor ?? null)
      })
      .catch(() => toast.error('Failed to load posts.'))
      .finally(() => setLoadingMore(false))
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  async function changeStatus(postId: number, status: string) {
    try {
      await api(`/posts/${postId}/status`, { method: 'POST', body: { status } })
      toast.success(`Moved to ${status}.`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status change failed.')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <LibraryIcon className="size-6 text-primary" />
          Content Library
        </h1>
        <p className="text-sm text-muted-foreground">
          Every generated post across its lifecycle.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="w-48"
          />
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All formats</SelectItem>
              <SelectItem value="technical_insight">Technical Insight</SelectItem>
              <SelectItem value="optimization_tip">Optimization Tip</SelectItem>
              <SelectItem value="problem_solution">Problem → Solution</SelectItem>
              <SelectItem value="before_after">Before → After</SelectItem>
              <SelectItem value="engineering_lesson">Engineering Lesson</SelectItem>
              <SelectItem value="release_highlight">Release Highlight</SelectItem>
              <SelectItem value="tool_discovery">Tool Discovery</SelectItem>
              <SelectItem value="performance_breakdown">Performance Breakdown</SelectItem>
              <SelectItem value="architecture_insight">Architecture Insight</SelectItem>
              <SelectItem value="debugging_story">Debugging Story</SelectItem>
              <SelectItem value="developer_debate">Developer Debate</SelectItem>
              <SelectItem value="case_study">Case Study</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!posts ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing here yet. Generate a post from the Trend Explorer.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                title={post.title}
                hook={post.hook}
                format={post.format}
                status={post.status}
                qualityScore={post.quality_score}
                metaLeft={<span>v{post.version_count ?? 1}</span>}
                actions={
                  post.status !== 'published' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <span>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {post.status !== 'review' && (
                          <DropdownMenuItem
                            onClick={() => void changeStatus(post.id, 'review')}
                          >
                            Move to Review
                          </DropdownMenuItem>
                        )}
                        {post.status !== 'ready' && (
                          <DropdownMenuItem
                            onClick={() => void changeStatus(post.id, 'ready')}
                          >
                            Mark Ready
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-danger focus:text-danger"
                          onClick={() => void changeStatus(post.id, 'archived')}
                        >
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null
                }
              />
            ))}
          </div>

          {nextCursor ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => load(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {/* Screen-reader only helper to satisfy tab semantics */}
      <span className={cn('hidden')}>{Object.keys(TAB_FILTERS).length} tabs</span>
    </div>
  )
}
