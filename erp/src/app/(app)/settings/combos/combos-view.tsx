"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { saveComboControls, saveFabricCombo } from "@/lib/actions/combo";
import { BUCKETS, BUCKET_LABEL, SUITABLE, SUITABLE_LABEL, isBucket, isSuitable, type Bucket, type Suitable } from "@/lib/combo";
import type { ComboControls } from "@/lib/settings";
import { cn } from "@/lib/utils";

type Row = {
  id: number;
  code: string;
  name: string;
  type: string | null;
  pattern: string | null;
  hex: string | null;
  thumb: string | null;
  balanceMtr: number;
  auto: Bucket | null;
  override: string | null;
  bucket: Bucket | null;
  suitableFor: string;
};

const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50";

export function CombosView({ controls, rows, ready, minMtr }: { controls: ComboControls; rows: Row[]; ready: boolean; minMtr: number }) {
  const router = useRouter();
  const [c, setC] = React.useState(controls);
  const [pending, start] = React.useTransition();
  const [q, setQ] = React.useState("");
  const saveControls = (next: ComboControls) => {
    setC(next);
    start(async () => {
      const r = await saveComboControls(next);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved — applies now");
      router.refresh();
    });
  };
  const saveRow = (row: Row, patch: { suitableFor?: Suitable; colourBucket?: Bucket | null }) =>
    start(async () => {
      const r = await saveFabricCombo({
        id: row.id,
        suitableFor: patch.suitableFor ?? (isSuitable(row.suitableFor) ? row.suitableFor : "both"),
        colourBucket: patch.colourBucket !== undefined ? patch.colourBucket : isBucket(row.override) ? row.override : null,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${row.code} saved`);
      router.refresh();
    });
  const shown = rows.filter((r) => !q.trim() || `${r.code} ${r.name} ${r.type ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="grid gap-5">
      {!ready && <p className="rounded-xl border border-warning bg-card p-4 text-sm">The per-fabric settings appear after the next database update.</p>}
      <section className="grid gap-3 rounded-xl border bg-card p-5" data-testid="combo-controls">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">
              Suggestions for customers <span className="ml">കസ്റ്റമർക്ക് കാണിക്കുക</span> {c.enabled ? <span className="text-success">ON</span> : <span className="text-destructive">OFF</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              &quot;ഇതിന് ചേരുന്ന പാൻറ്റ്&quot; on the try-on page, under the fabric and under the result. Owner and partners always see it there, for testing; staff
              always see it on the fabric page.
            </p>
          </div>
          <Switch aria-label="Suggestions on / off" checked={c.enabled} disabled={pending} onCheckedChange={(enabled) => saveControls({ ...c, enabled })} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
          <div>
            <p className="text-sm font-medium">
              Prefer slow-moving stock <span className="ml">പഴയ സ്റ്റോക്ക് ആദ്യം</span>
            </p>
            <p className="text-xs text-muted-foreground">Among trousers that match equally well, the ones in stock longest come first. Never overrides the colour rules.</p>
          </div>
          <Switch aria-label="Prefer slow-moving stock" checked={c.preferSlow} disabled={pending} onCheckedChange={(preferSlow) => saveControls({ ...c, preferSlow })} />
        </div>
        <p className="text-xs text-muted-foreground">
          A trouser is suggested only when it has {minMtr.toFixed(2)} m or more in stock (Regular pant, from{" "}
          <Link href="/settings" className="underline">
            Fabric requirement
          </Link>
          ), is not &quot;Shirting only&quot;, and is never a voile.
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <p className="font-medium">
            Fabrics <span className="ml">തുണികൾ</span> <span className="text-xs text-muted-foreground">· colour group worked out from the photo; change it if the guess is wrong</span>
          </p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, name, type" className="h-9 w-56 rounded-md border bg-background px-2 text-sm" />
        </div>
        <div className="divide-y">
          {shown.map((r) => (
            <div key={r.id} className="grid items-center gap-2 px-4 py-2 text-sm sm:grid-cols-[2.5rem_minmax(0,1fr)_12rem_12rem]" data-testid={`combo-fabric-${r.code}`}>
              <span className="size-10 overflow-hidden rounded border" style={{ background: r.hex ?? "#eee" }}>
                {r.thumb && <img src={r.thumb} alt="" className="size-full object-cover" loading="lazy" />}
              </span>
              <span className="min-w-0">
                <Link href={`/fabrics/${r.id}`} className="font-mono text-xs hover:underline">
                  {r.code}
                </Link>{" "}
                <span className="truncate">{r.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {[r.type, r.pattern, `${r.balanceMtr} m`].filter(Boolean).join(" · ")} · auto: {r.auto ? BUCKET_LABEL[r.auto].en : "no colour"}
                </span>
              </span>
              <select
                aria-label={`${r.code} colour group`}
                className={cn(sel, isBucket(r.override) && "border-primary font-medium")}
                disabled={!ready || pending}
                value={isBucket(r.override) ? r.override : ""}
                onChange={(e) => saveRow(r, { colourBucket: isBucket(e.target.value) ? e.target.value : null })}
              >
                <option value="">Automatic{r.auto ? ` (${BUCKET_LABEL[r.auto].en})` : ""}</option>
                {BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {BUCKET_LABEL[b].en} · {BUCKET_LABEL[b].ml}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${r.code} suitable for`}
                className={sel}
                disabled={!ready || pending}
                value={isSuitable(r.suitableFor) ? r.suitableFor : "both"}
                onChange={(e) => isSuitable(e.target.value) && saveRow(r, { suitableFor: e.target.value })}
              >
                {SUITABLE.map((s) => (
                  <option key={s} value={s}>
                    {SUITABLE_LABEL[s].en} · {SUITABLE_LABEL[s].ml}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {shown.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No fabrics.</p>}
        </div>
      </section>
    </div>
  );
}
