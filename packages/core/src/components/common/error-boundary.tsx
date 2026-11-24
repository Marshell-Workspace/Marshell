"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  private readonly handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 text-center border border-rose-500/30 bg-rose-500/5 rounded-lg">
          <AlertCircle className="size-6 text-rose-400 mb-2" />
          <h4 className="font-heading font-semibold text-foreground text-sm">
            Something went wrong
          </h4>
          <p className="font-mono text-xs text-muted-foreground mt-1 max-w-sm">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            className="mt-3 flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
            onClick={this.handleReset}
            type="button"
          >
            <RefreshCw className="size-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
