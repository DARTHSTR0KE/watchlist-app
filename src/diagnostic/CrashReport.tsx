import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * DIAGNOSTIC ONLY, on the diagnose-blank-screen branch. Never merged.
 *
 * Wraps the whole app. Where a render error would otherwise leave a blank
 * page, this shows the error, its stack and the component that threw, so
 * it can be read off the phone.
 */
export class CrashReport extends Component<{ children: ReactNode }, { report: string | null }> {
  state = { report: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    const e = error as { name?: string; message?: string; stack?: string }
    return { report: `${e?.name ?? 'Error'}: ${e?.message ?? String(error)}\n\n${e?.stack ?? ''}` }
  }

  componentDidCatch(_error: unknown, info: ErrorInfo) {
    this.setState((state) => ({
      report: `${state.report ?? ''}\n\nComponent stack:${info.componentStack ?? ''}`,
    }))
  }

  render() {
    if (this.state.report === null) return this.props.children
    return (
      <pre
        style={{
          margin: 0,
          padding: '1rem',
          minHeight: '100dvh',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: '12px',
          lineHeight: 1.4,
          color: '#f5f5f5',
          background: '#300',
        }}
      >
        {'The app crashed. Screenshot this and send it over.\n\n'}
        {this.state.report}
      </pre>
    )
  }
}
