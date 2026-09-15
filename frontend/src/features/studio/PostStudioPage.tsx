import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowsClockwiseIcon,
  CircleNotchIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  SparkleIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { ScorePill } from '@/components/shared/ScorePill'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Toolbar } from '@/components/shared/Toolbar'
import { contentFormatLabel } from '@/lib/content-formats'
import { cn } from '@/lib/utils'
import {
  clearPendingGeneration,
  deletePost,
  deleteTrendPosts,
  fetchGroupedPosts,
  getPendingGenerations,
  type ContentPost,
  type PostGroup,
} from '../trends/api'
import { FormatPickerDialog } from '../trends/FormatPickerDialog'

const TAB_STATUS: Record<string, string> = {
  active: 'draft,review,ready',
  published: 'published',
  archived: 'archived',
  all: '',
}

interface PendingDelete {
  type: 'post' | 'group'
  id: number
  title: string
}

export function PostStudioPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [groups, setGroups] = useState<PostGroup[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const tab = searchParams.get('tab') ?? 'active'
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [debounced, setDebounced] = useState(() => searchParams.get('q') ?? '')
  const [pickerTrendId, setPickerTrendId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 350)
    return () => clearTimeout(timer)
  }, [search])

  // Keep the filtered view linkable — tabs and search live in the URL.
  useEffect(() => {
    const params = new URLSearchParams()
    if (tab !== 'active') params.set('tab', tab)
    if (debounced) params.set('q', debounced)
    setSearchParams(params, { replace: true })
  }, [tab, debounced, setSearchParams])

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams)
    if (next === 'active') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  const filters = useMemo(
    () => ({
      status: TAB_STATUS[tab],
      search: debounced || undefined,
    }),
    [tab, debounced],
  )

  const load = useCallback(
    (cursor?: string | null) => {
      const isLoadMore = Boolean(cursor)

      if (isLoadMore) setLoadingMore(true)
      else setGroups(null)

      fetchGroupedPosts(filters, cursor)
        .then((res) => {
          setGroups((prev) => (isLoadMore && prev ? [...prev, ...res.data] : res.data))
          setNextCursor(res.next_cursor ?? null)

          // A tracked generation just landed → celebrate + stop watching it.
          for (const entry of getPendingGenerations()) {
            if (res.data.some((group) => group.trend.id === entry.trendId)) {
              clearPendingGeneration(entry.trendId)
              toast.success('Your generated post is ready.')
            }
          }
        })
        .catch(() => toast.error('Failed to load posts.'))
        .finally(() => setLoadingMore(false))
    },
    [filters],
  )

  useEffect(() => {
    load()
  }, [load])

  // Poll while a queued generation is still in flight.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden && getPendingGenerations().length > 0) load()
    }, 5000)

    const onVisible = () => {
      if (!document.hidden) load()
    }

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  async function confirmDelete() {
    if (!pendingDelete) return

    setDeleting(true)

    try {
      if (pendingDelete.type === 'post') {
        await deletePost(pendingDelete.id)
        toast.success('Post deleted.')
      } else {
        const result = await deleteTrendPosts(pendingDelete.id)
        toast.success(result.message)
      }

      setPendingDelete(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Post Studio"
        description="Every generated post, grouped under the trend it came from. Create one post per style, voice and angle — delete the ones you don't need."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => load()}
            title="Reload the list"
          >
            <ArrowsClockwiseIcon className="size-3.5" />
            Refresh
          </Button>
        }
      />

      <Toolbar className="justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="published">Posted</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-56">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            aria-label="Search posts"
            spellCheck={false}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </Toolbar>

      {!groups ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={NotePencilIcon}
          title="No posts here yet"
          description={
            tab === 'active'
              ? 'Open a trend in the Trends view and create your first post — posts are grouped here.'
              : 'Nothing matches this filter.'
          }
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/trends">Browse trends</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {groups.map((group) => (
              <TrendGroupCard
                key={group.trend.id}
                group={group}
                onOpen={(postId) => navigate(`/studio/${postId}`)}
                onNewVariant={() => setPickerTrendId(group.trend.id)}
                onDeletePost={(post) =>
                  setPendingDelete({
                    type: 'post',
                    id: post.id,
                    title: (post.hook ?? post.title ?? 'this post').trim(),
                  })
                }
                onDeleteGroup={() =>
                  setPendingDelete({
                    type: 'group',
                    id: group.trend.id,
                    title: group.trend.title,
                  })
                }
              />
            ))}
          </div>

          {nextCursor ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => load(nextCursor)} disabled={loadingMore}>
                {loadingMore ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}

      <FormatPickerDialog
        trendId={pickerTrendId ?? 0}
        open={pickerTrendId !== null}
        onOpenChange={(open) => !open && setPickerTrendId(null)}
        onQueued={() => {
          setTimeout(() => load(), 1500)
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={pendingDelete?.type === 'group' ? 'Delete all posts?' : 'Delete this post?'}
        description={
          pendingDelete?.type === 'group' ? (
            <>
              Every generated post for <strong>{pendingDelete.title}</strong> will be
              permanently removed, including versions and attached images. This cannot be undone.
            </>
          ) : (
            <>
              <strong>{pendingDelete?.title}</strong> will be permanently removed, including its
              version history and attached images. This cannot be undone.
            </>
          )
        }
        confirmLabel={pendingDelete?.type === 'group' ? 'Delete posts' : 'Delete post'}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
      />
    </div>
  )
}

interface GroupCardProps {
  group: PostGroup
  onOpen: (postId: number) => void
  onNewVariant: () => void
  onDeletePost: (post: ContentPost) => void
  onDeleteGroup: () => void
}

function TrendGroupCard({
  group,
  onOpen,
  onNewVariant,
  onDeletePost,
  onDeleteGroup,
}: GroupCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <ScorePill score={group.trend.trend_score} />
              <p className="min-w-0 text-sm font-medium leading-snug">{group.trend.title}</p>
              {group.trend.hack_style ? (
                <Badge variant="outline" className="font-mono text-[10px] text-signal">
                  tip
                </Badge>
              ) : null}
              {group.trend.deleted ? (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  trend removed
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {group.trend.category?.name ?? 'General'} ·{' '}
              {group.post_count === 1 ? '1 post' : `${group.post_count} posts`}
              {group.latest_at
                ? ` · latest ${new Date(group.latest_at).toLocaleDateString()}`
                : ''}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={onNewVariant}>
              <SparkleIcon className="size-3.5" />
              Generate another post
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Trend actions">
                  <DotsThreeIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={onDeleteGroup}>
                  <TrashIcon className="size-4" />
                  Delete all posts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-1.5">
        {group.posts.map((post) => (
          <div
            key={post.id}
            className="group flex items-center gap-3 rounded-md border border-border px-3 py-2 transition-colors duration-150 hover:border-border-strong"
          >
            <button
              type="button"
              onClick={() => onOpen(post.id)}
              className="min-w-0 flex-1 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <p className="truncate text-sm font-medium">
                {(post.hook ?? post.title ?? '(untitled)').trim()}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {contentFormatLabel(post.format)} · {post.tone}
                {post.angle ? ` · ${post.angle}` : ''} · v{post.version_count ?? 1}
                {post.hashtags && post.hashtags.length > 0
                  ? ` · ${post.hashtags.length} tags`
                  : ''}
              </p>
            </button>

            {post.quality_score !== null ? (
              <span
                className={cn(
                  'shrink-0 font-mono text-xs font-semibold tabular-nums',
                  post.quality_score >= 80 && 'text-success',
                  post.quality_score < 60 && 'text-danger',
                )}
                title="Quality score"
              >
                {Math.round(post.quality_score)}
              </span>
            ) : null}

            <StatusBadge status={post.status} />

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete post"
              className="text-muted-foreground hover:text-danger"
              onClick={() => onDeletePost(post)}
            >
              <TrashIcon className="size-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
