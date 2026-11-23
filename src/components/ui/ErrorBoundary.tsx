"use client";

import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";

/**
 * ErrorState — the failure surface.
 *
 * Loud, specific, and recoverable: the operator sees what broke, where, and a
 * 44px control to retry the read. No apology copy, no sad illustration.
 */
export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Raw diagnostic (route path, exception message). Shown in a mono plate. */
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  title = "Snapshot read failed",
  description = "The query did not complete. Your data is intact — this is a presentation-layer fault, so a retry is safe.",
  detail,
  onRetry,
  retryLabel = "Retry read",
  compact = false,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`border border-hairline bg-deck ${compact ? "p-4" : "p-5 sm:p-7"} ${className}`}
      style={{ borderLeft: "2px solid var(--loss)" }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-loss">
          Fault
        </span>
        <span className="h-3 w-px bg-hairline" aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
          Render layer
        </span>
      </div>

      <h3 className="mt-3 text-base font-medium tracking-tight text-chalk">
        {title}
      </h3>
      <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-ash">
        {description}
      </p>

      {detail ? (
        <pre className="mt-4 max-h-32 overflow-auto border border-hairline bg-void/70 p-3 font-mono text-[11px] leading-relaxed text-dim [overflow-wrap:anywhere]">
          {detail}
        </pre>
      ) : null}

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="tactile mt-4 inline-flex min-h-11 items-center gap-2 border border-hairline bg-riser px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-chalk hover:border-signal/60 hover:text-signal active:bg-void"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-3.2-6.9" />
            <path d="M21 3v6h-6" />
          </svg>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback; receives the error and a reset callback. */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Context label used in the console diagnostic. */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * ErrorBoundary — class boundary for client subtrees (tables, charts, the
 * scrape trigger). One broken widget must never blank the whole console.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[dhh-pulse] ${this.props.label ?? "client subtree"} crashed:`,
      error,
      info.componentStack
    );
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (typeof this.props.fallback === "function") {
      return this.props.fallback(error, this.reset);
    }
    if (this.props.fallback) return this.props.fallback;

    return (
      <ErrorState
        title="This panel stopped rendering"
        description="The rest of the console is unaffected. Reset the panel to re-run the query."
        detail={error.message}
        onRetry={this.reset}
        retryLabel="Reset panel"
      />
    );
  }
}
