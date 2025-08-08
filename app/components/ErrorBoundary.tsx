"use client";

import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = typeof error === "object" && error && "message" in error ? String((error as any).message) : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(_error: unknown) {
    // Intentionally empty; hook for logging if needed
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded border p-4 bg-red-50 text-red-800">
          <div className="font-medium mb-1">ErrorProneWidget crashed</div>
          <div className="text-sm">{this.state.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;


