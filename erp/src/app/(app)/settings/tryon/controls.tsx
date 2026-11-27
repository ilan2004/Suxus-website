"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Monitor, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { newTvLink, pairTv, saveTryonControls } from "@/lib/actions/tryon";
import { cn, rupees } from "@/lib/utils";

type C = { enabled: boolean; perDevice: 1 | 2; shopPerDay: number; monthlyCapInr: number; styles: boolean };

/** Settings > Try-on: the four controls (apply at once — no deploy) and the shop TV link. */
export function TryonControls({ value, spentInr, todayOk, tvLink }: { value: C; spentInr: number; todayOk: number; tvLink: string | null }) {
  const router = useRouter();
  const [v, setV] = React.useState({ ...value, shopPerDay: String(value.shopPerDay), monthlyCapInr: String(value.monthlyCapInr) });
  const [pending, start] = React.useTransition();
  const dirty = v.styles !== value.styles || v.enabled !== value.enabled || v.perDevice !== value.perDevice || Number(v.shopPerDay) !== value.shopPerDay || Number(v.monthlyCapInr) !== value.monthlyCapInr;
  const save = (next = v) =>
    start(async () => {
      const r = await saveTryonControls({ enabled: next.enabled, perDevice: next.perDevice, shopPerDay: Number(next.shopPerDay), monthlyCapInr: Number(next.monthlyCapInr), styles: next.styles });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved — applies now");
      router.refresh();
    });
  const cap = value.monthlyCapInr;
  const pct = cap > 0 ? Math.min(100, (spentInr / cap) * 100) : 100;
  const capReached = spentInr >= cap;
  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-xl border bg-card p-5" data-testid="tryon-controls">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">
              Try-on <span className="ml">ട്രൈ-ഓൺ</span> {v.enabled ? <span className="text-success">ON</span> : <span className="text-destructive">OFF</span>}
            </p>
            <p className="text-xs text-muted-foreground">Off: the page tells customers try-on is not available and to ask at the counter.</p>
          </div>
          <Switch
            aria-label="Try-on on / off"
            checked={v.enabled}
            disabled={pending}
            onCheckedChange={(enabled) => {
              const next = { ...v, enabled };
              setV(next);
              save(next);
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3" data-testid="styles-switch">
          <div>
            <p className="text-sm font-medium">
              Styling options for customers <span className="ml">സ്റ്റൈൽ</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Sleeve (half / full / rolled), tuck (inside / outside) and pocket chips before Generate — still one image per press. Off: customers get today&apos;s
              instruction unchanged. Owner and partners always see the chips, for testing.
            </p>
          </div>
          <Switch
            aria-label="Styling options for customers"
            checked={v.styles}
            disabled={pending}
            onCheckedChange={(styles) => {
              const next = { ...v, styles };
              setV(next);
              save(next);
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">
              Per person per day <span className="ml">ഒരാൾക്ക്</span>
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted p-0.5">
              {[1, 2].map((n) => (
                <button key={n} type="button" onClick={() => setV((x) => ({ ...x, perDevice: n as 1 | 2 }))} className={cn("h-8 rounded text-sm", v.perDevice === n ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")} aria-pressed={v.perDevice === n}>
                  {n}
                </button>
              ))}
            </div>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">
              Whole shop per day <span className="ml">കടയ്ക്ക് ആകെ</span>
            </span>
            <Input aria-label="Whole shop per day" type="number" inputMode="numeric" min={0} value={v.shopPerDay} onChange={(e) => setV((x) => ({ ...x, shopPerDay: e.target.value }))} />
            <span className="text-xs text-muted-foreground">{todayOk} used today</span>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">
              Monthly spend cap (₹) <span className="ml">മാസ പരിധി</span>
            </span>
            <Input aria-label="Monthly spend cap" type="number" inputMode="numeric" min={0} value={v.monthlyCapInr} onChange={(e) => setV((x) => ({ ...x, monthlyCapInr: e.target.value }))} />
          </label>
        </div>
        <div className="grid gap-1" data-testid="tryon-spend">
          <div className="flex justify-between text-sm">
            <span>
              Used this month <span className="ml">ഈ മാസം ചെലവായത്</span>
            </span>
            <span className={cn("tabular-nums font-medium", capReached && "text-destructive")}>
              {rupees(spentInr, true)} of {rupees(cap, true)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-2 rounded-full", capReached ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
          {capReached && <p className="text-xs text-destructive">Cap reached — try-ons are stopped until you raise the cap (or next month).</p>}
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={() => save()} disabled={!dirty || pending}>
            {pending && <Loader2 className="animate-spin" />} Save limits
          </Button>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border bg-card p-5" data-testid="tv-link">
        <p className="flex items-center gap-2 font-medium">
          <Monitor className="size-4" /> Shop TV <span className="ml">കടയിലെ ടി.വി.</span>
        </p>
        <PairTv />
        <p className="text-xs text-muted-foreground">
          The TV shows the QR, and a customer&apos;s result only when that customer presses &quot;Show on the shop TV&quot;. Another way (a computer, or a phone browser): open this link
          once and leave it.
        </p>
        {tvLink ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs" data-testid="tv-url">
              {tvLink}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(tvLink).then(() => toast.success("Link copied"))}>
              <Copy /> Copy
            </Button>
            <a href={tvLink} target="_blank" className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-sm hover:bg-accent">
              Open
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No TV link yet.</p>
        )}
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (tvLink && !window.confirm("Make a new TV link? The old link stops working and every paired TV is disconnected — pair the TV again afterwards.")) return;
                const r = await newTvLink();
                if (!r.ok) return void toast.error(r.error);
                toast.success("New TV link made");
                router.refresh();
              })
            }
          >
            <RefreshCw /> {tvLink ? "Make a new link" : "Make the TV link"}
          </Button>
        </div>
      </section>
    </div>
  );
}

/** Pair a TV: open suxus-erp.vercel.app/tryon/display on the TV, type the 6 numbers it shows. */
function PairTv() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [pending, start] = React.useTransition();
  const go = () =>
    start(async () => {
      const r = await pairTv(code);
      if (!r.ok) return void toast.error(r.error);
      setCode("");
      toast.success("TV paired — it switches to the QR in a few seconds");
      router.refresh();
    });
  return (
    <div className="grid gap-2 rounded-lg border-2 border-primary/30 bg-primary/5 p-3" data-testid="pair-tv">
      <p className="text-sm font-medium">
        Pair a TV <span className="ml">ടി.വി. ജോടിയാക്കുക</span>
      </p>
      <ol className="list-decimal pl-5 text-xs text-muted-foreground">
        <li>
          On the TV browser open <b>suxus-erp.vercel.app/tryon/display</b>
        </li>
        <li>Type the 6 numbers the TV shows here</li>
      </ol>
      <div className="flex gap-2">
        <Input
          aria-label="TV code"
          inputMode="numeric"
          autoComplete="off"
          maxLength={7}
          placeholder="123 456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && go()}
          className="h-11 max-w-40 text-center text-xl tracking-widest tabular-nums"
        />
        <Button type="button" className="h-11" onClick={go} disabled={pending || code.replace(/\D/g, "").length !== 6}>
          {pending && <Loader2 className="animate-spin" />} Pair
        </Button>
      </div>
    </div>
  );
}
