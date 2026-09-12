import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Toolbar } from '@/components/shared/Toolbar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { CONTENT_FORMATS } from '@/lib/content-formats'
import { POST_STATUS_ACTIONS } from '@/lib/post-status'
import { deletePost, fetchPosts, type ContentPost } from '../trends/api'

const TAB_FILTERS: Record<string, string> = {
  active: 'draft,review,ready',
  published: 'published',
  archived: 'archived',
  all: '',
}

export function LibraryPage() {
  const navigate = useNavigate()

  const [posts, setPosts] = useState<ContentPost[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [tab, setTab] = useState('active')
  const [format, setFormat] = useState('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ContentPost | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const load = useCallback(
    (cursor?: string | null) => {
      const isLoadMore = Boolean(cursor)

      if (isLoadMore) setLoadingMore(true)
      else setPosts(null)

      fetchPosts({ ...filters, ...(cursor ? { cursor } : {}) })
        .then((res) => {
          setPosts((prev) => (isLoadMore && prev ? [...prev, ...res.data] : res.data))
          setNextCursor(res.next_cursor ?? null)
        })
        .catch(() => toast.error('Failed to load posts.'))
        .finally(() => setLoadingMore(false))
    },
    [filters],
  )

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

  async function confirmDelete() {
    if (!pendingDelete) return

    setDeleting(true)

    try {
      await deletePost(pendingDelete.id)
      toast.success('Post deleted.')
      setPendingDelete(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <PageHeader
        title="Library"
        description="Every generated post across its lifecycle — search, filter and manage status."
      />

      <Toolbar className="justify-between">
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
            className="h-8 w-48 text-sm"
          />
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All formats</SelectItem>
              {CONTENT_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Toolbar>

      {!posts ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={LibraryIcon}
          title="Nothing here yet"
          description="Generate a post from a trend and it will show up in this library."
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/trends')}>
              Browse trends
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                title={post.title}
                hook={post.hook}
                format={post.format}
                tone={post.tone}
                status={post.status}
                qualityScore={post.quality_score}
                hashtagCount={post.hashtags?.length ?? 0}
                onClick={() => navigate(`/studio/${post.id}`)}
                metaLeft={<span>v{post.version_count ?? 1}</span>}
                metaRight={
                  <span>
                    {new Date(post.updated_at ?? post.generated_at ?? Date.now()).toLocaleDateString()}
                  </span>
                }
                actions={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Post actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {POST_STATUS_ACTIONS.filter((a) => a.status !== post.status).map((action) => (
                        <DropdownMenuItem
                          key={action.status}
                          onClick={() => void changeStatus(post.id, action.status)}
                        >
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setPendingDelete(post)}
                      >
                        Delete post
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            ))}
          </div>

          {nextCursor ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => load(nextCursor)} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this post?"
        description={
          <>
            <strong>{(pendingDelete?.hook ?? pendingDelete?.title ?? 'This post').slice(0, 80)}</strong>{' '}
            will be permanently removed, including its version history and attached images. This
            cannot be undone.
          </>
        }
        confirmLabel="Delete post"
        onConfirm={() => void confirmDelete()}
        loading={deleting}
      />
    </div>
  )
}
