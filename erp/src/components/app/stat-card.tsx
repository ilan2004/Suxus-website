import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  ml,
  value,
  sub,
  icon: Icon,
  tone = "default",
  className,
  href,
}: {
  label: string;
  ml?: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "gold" | "warning" | "destructive" | "success";
  className?: string;
  /** Makes the card a link to the records behind the number. */
  href?: string;
}) {
  const toneCls = {
    default: "bg-primary/10 text-primary",
    gold: "bg-gold/20 text-[#8a6a2a] dark:text-gold",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    success: "bg-success/15 text-success",
  }[tone];
  const body = (
    <div className={cn("group relative h-full rounded-xl border bg-card p-4 shadow-xs", href && "transition-colors hover:border-primary/40", className)}>
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
      {href && <ChevronRight className="absolute right-3 bottom-3 size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
