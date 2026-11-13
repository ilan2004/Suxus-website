"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, monthEnd, monthStart, today } from "@/lib/utils";


/** Date range in the URL (?from=&to=) so the server computes the numbers. */
export function PeriodPicker({ from, to, presets = ["month", "last", "year", "all"] }: { from: string; to: string; presets?: ("month" | "last" | "year" | "all")[] }) {
  const router = useRouter();
  const path = usePathname();
  const go = (f: string, t: string) => router.push(`${path}?from=${f}&to=${t}`);
  const t = today();
  const lastEnd = addDays(monthStart(t), -1);
  const fy = Number(t.slice(5, 7)) >= 4 ? `${t.slice(0, 4)}-04-01` : `${Number(t.slice(0, 4)) - 1}-04-01`;
  const opts = {
    month: ["This month", monthStart(t), monthEnd(t)],
    last: ["Last month", monthStart(lastEnd), lastEnd],
    year: ["This FY", fy, t],
    all: ["All time", "2020-01-01", t],
  } as const;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => {
        const [label, f, tt] = opts[p];
        return (
          <Button key={p} size="sm" variant={from === f && to === tt ? "default" : "outline"} onClick={() => go(f, tt)}>
            {label}
          </Button>
        );
      })}
      <div className="flex items-center gap-1.5">
        <Input type="date" value={from} onChange={(e) => e.target.value && go(e.target.value, to)} className="h-8 w-36" />
        <span className="text-muted-foreground">→</span>
        <Input type="date" value={to} onChange={(e) => e.target.value && go(from, e.target.value)} className="h-8 w-36" />
      </div>
    </div>
  );
}
