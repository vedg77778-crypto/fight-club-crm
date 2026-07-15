import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🥊</div>
              <h2 className="text-xl font-bold text-white mb-2">
                Took a hit!
              </h2>
              <p className="text-gray-400 mb-6">
                Something went wrong. Try refreshing the app.
              </p>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined })
                  window.location.hash = '#/'
                  window.location.reload()
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl btn-impact"
              >
                Get Back Up
              </button>
              {this.state.error && (
                <p className="text-gray-600 text-xs mt-4 font-mono">
                  {this.state.error.message}
                </p>
              )}
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
