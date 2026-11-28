"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveWebOrderToCustomer, setWebOrderStatus } from "@/lib/actions/web-orders";
import { cn } from "@/lib/utils";

/** Save to the customer + measurements, and the status (new / confirmed / cancelled). */
export function WebOrderActions({ id, status, customer, handled }: { id: number; status: string; customer: { id: number; code: string; name: string } | null; handled: string | null }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <div className="grid gap-3 border-t pt-3">
      {customer ? (
        <p data-testid="saved-customer">
          Saved to{" "}
          <Link href={`/customers/${customer.id}`} className="font-medium underline">
            {customer.code} · {customer.name}
          </Link>{" "}
          with the measurements. Make the stitching order from the customer as usual.
        </p>
      ) : (
        <Button
          type="button"
          disabled={pending}
          data-testid="save-customer"
          onClick={() =>
            start(async () => {
              const r = await saveWebOrderToCustomer(id);
              if (!r.ok) return void toast.error(r.error);
              toast.success(`Saved — ${r.data.measurements} measurement record${r.data.measurements === 1 ? "" : "s"}`);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Save to customer & measurements
        </Button>
      )}
      <div className="grid grid-cols-3 gap-1 rounded-md border bg-muted p-0.5" role="radiogroup" aria-label="Status">
        {(["new", "confirmed", "cancelled"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setWebOrderStatus(id, s);
                if (!r.ok) return void toast.error(r.error);
                router.refresh();
              })
            }
            className={cn("h-9 rounded text-sm capitalize", status === s ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}
            data-testid={`status-${s}`}
          >
            {s}
          </button>
        ))}
      </div>
      {handled && <p className="text-xs text-muted-foreground">Last changed by {handled}</p>}
    </div>
  );
}
