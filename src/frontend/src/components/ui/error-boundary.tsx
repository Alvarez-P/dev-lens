'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/atoms/button';

interface ErrorBoundaryProps {
  children: ReactNode;

  fallback?: ReactNode;

  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-error-500" />
          <h2 className="text-lg font-semibold text-surface-300">Something went wrong</h2>
          <p className="mt-1 max-w-md text-sm text-surface-500">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <Button variant="outline" size="sm" className="mt-6" onClick={this.handleRetry}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
