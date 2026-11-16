import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { SupplierDue } from "@/lib/queries";
import { daysAgo, fmtDateMon, rupees } from "@/lib/utils";

/** Who we owe money to — used in the "Balance to pay" panel and on the Dashboard. */
export function SupplierDuesList({ rows, total, today, onNavigate }: { rows: SupplierDue[]; total: number; today: string; onNavigate?: () => void }) {
  if (!rows.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nothing outstanding — <span className="font-ml">എല്ലാം കൊടുത്തു</span>
      </p>
    );
  }
  return (
    <div className="grid">
      <ul className="grid gap-0.5">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/suppliers/${r.id}`} onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">{rupees(r.balance)}</span>
                </span>
                {r.supplies && <span className="block truncate text-xs text-muted-foreground">{r.supplies}</span>}
                <span className="block truncate text-[11px] text-muted-foreground/80">
                  {r.lastPaid ? `Last paid ${fmtDateMon(r.lastPaid)} · ${daysAgo(r.lastPaid, today)}` : "No payment yet"}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t px-2 pt-3 pr-9">
        <span className="text-sm font-semibold">
          Total <span className="ml">ആകെ</span>
        </span>
        <span className="text-base font-bold tabular-nums text-destructive">{rupees(total)}</span>
      </div>
    </div>
  );
}
