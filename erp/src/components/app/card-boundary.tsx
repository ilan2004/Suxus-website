"use client";

import * as React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Keeps one Dashboard card's failure inside that card. Anything that throws while the card renders —
 * on the server (re-thrown here by React) or in the browser — shows a small "couldn't load" box instead
 * of taking the whole page down.
 */
export class CardBoundary extends React.Component<{ name: string; children: React.ReactNode; className?: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[dashboard] card "${this.props.name}" failed to render`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <CardFailed name={this.props.name} className={this.props.className} />;
  }
}

export function CardFailed({ name, className }: { name: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-dashed border-warning/50 bg-warning/5 p-4 text-sm ${className ?? ""}`} role="alert">
      <AlertTriangle className="size-4 shrink-0 text-warning" />
      <span className="flex-1">
        <span className="font-medium">{name}</span> couldn&apos;t load. The rest of the Dashboard is fine.
      </span>
      <button type="button" onClick={() => location.reload()} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted">
        <RotateCw className="size-3" /> Retry
      </button>
    </div>
  );
}
