import { Component } from 'react'
import type { ReactNode } from 'react'
import { describeError, reportQuietly } from '../lib/dbError'
import { ErrorLine, Screen } from './Screen'
import { Ticket } from './Ticket'

/**
 * Around every screen. A screen that throws while rendering takes only
 * itself down: the header and footer stay, the reason is said, and it can
 * be tried again. Without this one throw anywhere unmounts the whole app
 * and leaves a blank page.
 */
export class ScreenBoundary extends Component<
  { children: ReactNode },
  { failure: string | null }
> {
  state = { failure: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    return { failure: describeError(error) }
  }

  componentDidCatch(error: unknown) {
    reportQuietly('Showing this screen', error)
  }

  render() {
    if (this.state.failure === null) return this.props.children
    return (
      <Screen>
        <Ticket heading="SOMETHING BROKE" figure="—" line="This screen couldn't be shown" />
        <ErrorLine>{this.state.failure}</ErrorLine>
        <button type="button" className="btn-field" onClick={() => this.setState({ failure: null })}>
          Try again
        </button>
      </Screen>
    )
  }
}
