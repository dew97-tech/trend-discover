import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
  info: string | null
}

/**
 * Last-resort boundary: a render crash must NEVER present as a silent
 * blank screen. Shows the error + stack on-screen in dev.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack ?? null })
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { error, info } = this.state

    if (error === null) {
      return this.props.children
    }

    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <div className="rounded-lg border border-danger/40 bg-danger-soft p-5">
          <h1 className="text-lg font-semibold text-danger">Something crashed while rendering</h1>
          <p className="mt-1 text-sm text-danger/80">
            The UI stopped to avoid corrupt state. Details below — refresh after fixing.
          </p>
        </div>

        <pre className="overflow-auto rounded-lg bg-surface-muted p-4 text-xs leading-relaxed">
          {error.name}: {error.message}
          {'\n\n'}
          {error.stack}
          {'\n\nComponent stack:\n'}
          {info}
        </pre>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover"
        >
          Reload app
        </button>
      </div>
    )
  }
}
