import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-red-400 mb-4">🚨 App Error</h1>
            <div className="bg-gray-800 p-6 rounded-lg mb-6">
              <h2 className="text-xl font-semibold mb-2">Error Details:</h2>
              <p className="text-red-300 mb-4">{this.state.error?.message}</p>
              <details className="text-sm text-gray-300">
                <summary className="cursor-pointer text-blue-400">Stack Trace</summary>
                <pre className="mt-2 whitespace-pre-wrap">
                  {this.state.error?.stack}
                </pre>
              </details>
            </div>
            
            <div className="bg-blue-900 p-6 rounded-lg mb-6">
              <h2 className="text-xl font-semibold mb-2">🔧 Debugging Info:</h2>
              <ul className="space-y-2 text-sm">
                <li>• Buffer available: {typeof window.Buffer !== 'undefined' ? '✅' : '❌'}</li>
                <li>• Buffer.alloc: {typeof window.Buffer?.alloc === 'function' ? '✅' : '❌'}</li>
                <li>• Global: {typeof window.global !== 'undefined' ? '✅' : '❌'}</li>
                <li>• Process: {typeof window.process !== 'undefined' ? '✅' : '❌'}</li>
                <li>• Crypto: {typeof window.crypto !== 'undefined' ? '✅' : '❌'}</li>
                <li>• Environment: {import.meta.env.MODE}</li>
                <li>• Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅' : '❌'}</li>
              </ul>
            </div>
            
            <button 
              onClick={() => window.location.reload()} 
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
            >
              🔄 Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 