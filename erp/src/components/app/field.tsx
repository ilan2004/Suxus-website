import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Form field: English label with Malayalam sub-label, optional hint/error. */
export function Field({
  label,
  ml,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  ml?: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        <span>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </span>
        {ml && <span className="ml">{ml}</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
