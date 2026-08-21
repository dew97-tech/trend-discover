import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Sparkles, PenLine, ClipboardCheck, Send } from 'lucide-react'

const stats = [
  { label: 'New Trends', icon: TrendingUp },
  { label: 'High Potential', icon: Sparkles },
  { label: 'Generated Posts', icon: PenLine },
  { label: 'Pending Review', icon: ClipboardCheck },
  { label: 'Published', icon: Send },
]

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Today's Intelligence</h1>
        <p className="text-sm text-muted-foreground">
          Software engineering trends worth posting about — updated continuously.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(({ label, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="size-3.5" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Trending Now
        </h2>
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Trend cards will appear here once source collectors run (Phase 2).
        </div>
      </section>
    </div>
  )
}
