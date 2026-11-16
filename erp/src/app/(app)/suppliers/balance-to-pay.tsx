"use client";

import * as React from "react";
import { CircleDollarSign } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StatCard } from "@/components/app/stat-card";
import { SupplierDuesList } from "@/components/app/supplier-dues";
import type { SupplierDue } from "@/lib/queries";
import { rupees } from "@/lib/utils";

export function BalanceToPayCard({ rows, total, today }: { rows: SupplierDue[]; total: number; today: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="block h-full w-full cursor-pointer rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label="Show who the balance is owed to">
          <StatCard
            label="Balance to pay"
            ml="കൊടുക്കാനുള്ളത്"
            value={rupees(total)}
            sub={rows.length ? `${rows.length} supplier${rows.length > 1 ? "s" : ""} · tap to see` : undefined}
            icon={CircleDollarSign}
            tone={total > 0 ? "destructive" : "success"}
            interactive
          />
        </button>
      </SheetTrigger>
      <SheetContent side="responsive" className="gap-2">
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <SheetHeader className="pt-2 sm:pt-5">
          <SheetTitle>
            Balance to pay — <span className="font-ml">കൊടുക്കാനുള്ളത്</span>
          </SheetTitle>
          <SheetDescription>Largest first. Tap a supplier to open their account.</SheetDescription>
        </SheetHeader>
        <div className="px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SupplierDuesList rows={rows} total={total} today={today} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
