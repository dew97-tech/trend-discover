import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PenSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { clearPendingGeneration, fetchPosts, getPendingGenerations, type ContentPost } from '../trends/api'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  ready: 'bg-success-soft text-success',
  review: 'bg-warning-soft text-warning',
  draft: 'bg-surface-muted text-muted-foreground',
  published: 'bg-info-soft text-info',
  failed_generation: 'bg-danger-soft text-danger',
}

export function PostStudioPage() {
  const [posts, setPosts] = useState<ContentPost[] | null>(null)
  const navigate = useNavigate()

  const load = useCallback(() => {
    fetchPosts()
      .then((res) => {
        setPosts(res.data)

        // A tracked generation just landed → celebrate + stop watching it.
        const pending = getPendingGenerations()
        for (const entry of pending) {
          if (res.data.some((p) => p.trend_id === entry.trendId)) {
            clearPendingGeneration(entry.trendId)
            toast.success('Your generated post is ready.')
          }
        }
      })
      .catch(() => {
        setPosts([])
        toast.error('Failed to load posts.')
      })
  }, [])

  useEffect(() => {
    load()

    // Poll every 5s while a queued generation is still in flight
    // (real AI runs take 1.5–3+ minutes — far beyond the old 30s window).
    const timer = setInterval(() => {
      if (!document.hidden && getPendingGenerations().length > 0) load()
    }, 5000)

    // Instant refresh when the user returns to the tab.
    const onVisible = () => {
      if (!document.hidden) load()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <PenSquare className="size-6 text-primary" />
          Post Studio
        </h1>
        <p className="text-sm text-muted-foreground">
          Generated posts and their quality verdicts. Edit freely — every save creates a
          version.
        </p>
      </header>

      {!posts ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No posts yet. Open a trend in the{' '}
          <Link to="/trends" className="text-primary hover:underline">
            Trend Explorer
          </Link>{' '}
          and click Generate Post.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {posts.map((post) => (
            <Card
              key={post.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/studio/${post.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {post.format.replaceAll('_', ' ')}
                  </Badge>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      STATUS_STYLES[post.status] ?? 'bg-surface-muted',
                    )}
                  >
                    {post.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <CardTitle className="line-clamp-2 pt-1 text-sm leading-snug">
                  {post.hook ?? post.title ?? '(untitled)'}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Quality{' '}
                  <strong className={cn(post.quality_score !== null && post.quality_score >= 80 && 'text-success')}>
                    {post.quality_score !== null ? Math.round(post.quality_score) : '—'}
                  </strong>
                  {' · '}
                  v{post.version_count ?? 1}
                </span>
                <span>
                  {new Date(post.generated_at ?? Date.now()).toLocaleDateString()}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {posts && posts.length > 0 ? (
        <p className="text-right text-xs text-muted-foreground">
          <Button variant="link" size="sm" onClick={load} className="h-auto p-0 text-xs">
            Refresh
          </Button>
        </p>
      ) : null}
    </div>
  )
}
