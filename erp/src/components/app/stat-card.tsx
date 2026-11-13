import * as React from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  ml,
  value,
  sub,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  ml?: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "gold" | "warning" | "destructive" | "success";
  className?: string;
}) {
  const toneCls = {
    default: "bg-primary/10 text-primary",
    gold: "bg-gold/20 text-[#8a6a2a] dark:text-gold",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    success: "bg-success/15 text-success",
  }[tone];
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-xs", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {label} {ml && <span className="ml">{ml}</span>}
          </p>
          <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", toneCls)}>
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
    </div>
  );
}
