"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setEnquiryContacted } from "@/lib/actions/tryon";
import { formatPhone, waMeLink } from "@/lib/phone";
import type { TryonEnquiry } from "@/lib/tryon-admin";
import { cn } from "@/lib/utils";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });

export function EnquiriesView({ rows }: { rows: TryonEnquiry[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<number | null>(null);
  // the tick shows at once; the list is refreshed from the server after saving
  const [mine, setMine] = React.useState<Record<number, boolean>>({});
  const tick = async (r: TryonEnquiry, v: boolean) => {
    setBusy(r.id);
    setMine((m) => ({ ...m, [r.id]: v }));
    const res = await setEnquiryContacted(r.id, v);
    setBusy(null);
    if (!res.ok) {
      setMine((m) => ({ ...m, [r.id]: !v }));
      return void toast.error(res.error);
    }
    router.refresh();
  };
  const isDone = (r: TryonEnquiry) => mine[r.id] ?? r.contacted;
  if (!rows.length) return <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No enquiries yet. They appear here when a customer taps &quot;I want this&quot; on a try-on.</p>;
  return (
    <div className="grid gap-3" data-testid="enquiries">
      {rows.map((r) => (
        <article key={r.id} className={cn("flex gap-3 rounded-xl border bg-card p-3", isDone(r) && "opacity-60")}>
          {r.hasImage ? (
            <a href={`/api/tryon-admin/image/${r.id}`} target="_blank" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/tryon-admin/image/${r.id}`} alt="" className="h-28 w-21 rounded-lg border object-cover" />
            </a>
          ) : (
            <div className="grid h-28 w-21 shrink-0 place-items-center rounded-lg border border-dashed p-1 text-center text-[10px] text-muted-foreground">image deleted after 7 days</div>
          )}
          <div className="grid min-w-0 flex-1 content-start gap-0.5 text-sm">
            <p className="text-xs text-muted-foreground">{when(r.createdAt)}</p>
            <p className="text-base font-semibold">{r.name}</p>
            <p className="flex flex-wrap gap-x-3">
              <a href={`tel:${r.phone}`} className="tabular-nums underline">
                {formatPhone(r.phone)}
              </a>
              <a href={waMeLink(r.phone) ?? undefined} target="_blank" className="text-[#128C4B] underline">
                WhatsApp
              </a>
            </p>
            <p className="truncate">
              {r.fabric}
              {r.variant ? ` · ${r.variant}` : ""}
            </p>
            <label className="mt-1 inline-flex w-fit cursor-pointer items-center gap-2">
              <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={isDone(r)} disabled={busy === r.id} onChange={(e) => void tick(r, e.target.checked)} aria-label={`Contacted ${r.name}`} />
              <span>
                Contacted <span className="ml">ബന്ധപ്പെട്ടു</span>
                {r.contacted && r.contactedBy ? <span className="text-xs text-muted-foreground"> · {r.contactedBy}{r.contactedAt ? `, ${when(r.contactedAt)}` : ""}</span> : null}
              </span>
            </label>
          </div>
        </article>
      ))}
    </div>
  );
}
