import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info);
  }
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-[var(--bg)]">
          <div className="text-center">
            <p className="text-lg text-[var(--text)]">Terjadi kesalahan. Muat ulang halaman.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-btn border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Muat ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
