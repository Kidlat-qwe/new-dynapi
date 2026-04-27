import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep a console trace for debugging in devtools.
    // eslint-disable-next-line no-console
    console.error('UI crashed:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      (this.state.error && (this.state.error.message || String(this.state.error))) ||
      'Unknown error';

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-soft p-4 sm:p-5">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Something went wrong</h2>
          <p className="mt-2 text-sm text-gray-700 break-words whitespace-pre-wrap">{message}</p>
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

