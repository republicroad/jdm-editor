import React from 'react';

type SafeBoundaryProps = {
  children: React.ReactNode;
  /** Custom fallback UI shown when an error is caught. */
  fallback?: React.ReactNode;
  /** Called when an error is caught (for logging/telemetry). */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type SafeBoundaryState = {
  error: Error | null;
};

/**
 * Production-grade error boundary for complex editor surfaces.
 *
 * A rendering crash inside a subtree (xyflow node, CodeMirror, WASM call,
 * etc.) would otherwise unmount the entire component tree. This boundary
 * catches the error, shows a fallback (custom or built-in), and offers a
 * retry button that resets the subtree's React state.
 *
 * Wrap at component entry points (DecisionGraph, DecisionTable, Function,
 * Expression), NOT inside individual leaves — boundary granularity should
 * match the blast-radius the user can tolerate.
 */
export class SafeBoundary extends React.Component<SafeBoundaryProps, SafeBoundaryState> {
  state: SafeBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SafeBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div
          role='alert'
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 24,
            border: '1px solid var(--grl-color-error-border, #ffccc7)',
            borderRadius: 8,
            background: 'var(--grl-color-error-bg, #fff2f0)',
            color: 'var(--grl-color-text, rgba(0,0,0,0.88))',
            minHeight: 120,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>Something went wrong</div>
          <div style={{ fontSize: 12, opacity: 0.65, wordBreak: 'break-all', maxWidth: 480, textAlign: 'center' }}>
            {this.state.error.message}
          </div>
          <button
            type='button'
            onClick={this.reset}
            style={{
              marginTop: 4,
              padding: '4px 16px',
              borderRadius: 6,
              border: '1px solid var(--grl-color-border, #d9d9d9)',
              background: 'var(--grl-color-bg-container, #fff)',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
