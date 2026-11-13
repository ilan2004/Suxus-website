"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/app/field";
import { ListSelect } from "@/components/app/search-select";
import { deleteIncentive, recordIncentive } from "@/lib/actions/business";
import type { IncentiveRow } from "@/lib/reports";
import { cn, fmtDate, rupees, today } from "@/lib/utils";

type Hist = { id: number; fromDate: string; toDate: string; staffId: number; name: string; business: number; collected: number; ratePct: number; incentive: number; paid: number };
const pct = (r: number) => `${(r * 100).toFixed(r * 100 % 1 ? 1 : 0)}%`;

export function IncentiveView({
  from,
  to,
  rows,
  slabs,
  modes,
  history,
}: {
  from: string;
  to: string;
  rows: IncentiveRow[];
  slabs: { from: number; to: number; rate: number }[];
  modes: string[];
  history: Hist[];
}) {
  const router = useRouter();
  const [all, setAll] = React.useState(false);
  const [pay, setPay] = React.useState<IncentiveRow | null>(null);
  const shown = rows.filter((r) => all || r.eligible);
  const balance = history.reduce((s, h) => s + h.incentive - h.paid, 0);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-medium">
              {fmtDate(from)} → {fmtDate(to)}
            </p>
            <Label className="text-xs text-muted-foreground">
              <Switch checked={all} onCheckedChange={setAll} /> Show all staff
            </Label>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead className="text-right">Stitching</TableHead>
                <TableHead className="text-right">Bulk</TableHead>
                <TableHead className="text-right">Fabric</TableHead>
                <TableHead className="text-right">Business</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Incentive</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-sm whitespace-normal text-muted-foreground">
                    Nobody is marked for incentive. Turn on “Gets incentive” or set an “Own incentive %” on the{" "}
                    <Link href="/staff" className="underline">
                      Staff
                    </Link>{" "}
                    page — or switch on “Show all staff”.
                  </TableCell>
                </TableRow>
              )}
              {shown.map((r) => (
                <TableRow key={r.staffId}>
                  <TableCell>
                    <Link href={`/staff/${r.staffId}?from=${from}&to=${to}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.role}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{rupees(r.stitching)}</TableCell>
                  <TableCell className="text-right tabular-nums">{rupees(r.bulk)}</TableCell>
                  <TableCell className="text-right tabular-nums">{rupees(r.fabric)}</TableCell>
                  <TableCell className="text-right tabular-nums">{rupees(r.business)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{rupees(r.collected)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={r.ownRate ? "violet" : "secondary"}>
                      {pct(r.rate)}
                      {r.ownRate && " own"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-display text-base font-semibold tabular-nums">{rupees(r.incentive, true)}</TableCell>
                  <TableCell className="text-right">
                    {r.record ? (
                      <button onClick={() => setPay(r)} className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="size-3.5" /> Paid {rupees(r.record.paid)}
                      </button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={r.incentive <= 0} onClick={() => setPay(r)}>
                        Record
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {shown.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{rupees(shown.reduce((s, r) => s + r.collected, 0))}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{rupees(shown.reduce((s, r) => s + r.incentive, 0), true)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>

        <div className="grid content-start gap-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-2 text-sm font-medium">
              Slab table <span className="ml">സ്ലാബ് പട്ടിക</span>
            </p>
            <table className="w-full text-sm">
              <tbody>
                {slabs.map((s) => (
                  <tr key={s.from} className="border-b last:border-0">
                    <td className="py-1.5 text-muted-foreground">
                      {rupees(s.from)} – {s.to >= 9_999_999 ? "above" : rupees(s.to)}
                    </td>
                    <td className="py-1.5 text-right font-semibold">{pct(s.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              The whole collection gets the rate of the slab it falls in (e.g. ₹1,00,000 → 1.5% = ₹1,500). “Own %” on Staff overrides the slab. Change slabs in{" "}
              <Link href="/settings" className="underline">
                Settings
              </Link>
              .
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Incentive still to pay (all periods)</p>
            <p className={cn("font-display text-2xl font-semibold", balance > 0 ? "text-destructive" : "text-success")}>{rupees(balance, true)}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <p className="border-b px-4 py-3 text-sm font-medium">
          History <span className="ml">മുൻ കണക്കുകൾ</span>
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead className="text-right">Collected</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Incentive</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-16 text-center text-muted-foreground">
                  No incentive recorded yet
                </TableCell>
              </TableRow>
            )}
            {history.map((h) => (
              <TableRow key={h.id}>
                <TableCell>
                  <Link href={`/incentive?from=${h.fromDate}&to=${h.toDate}`} className="hover:underline">
                    {fmtDate(h.fromDate)} → {fmtDate(h.toDate)}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/staff/${h.staffId}?from=${h.fromDate}&to=${h.toDate}`} className="hover:underline">
                    {h.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{rupees(h.collected)}</TableCell>
                <TableCell className="text-right">{pct(h.ratePct)}</TableCell>
                <TableCell className="text-right tabular-nums">{rupees(h.incentive, true)}</TableCell>
                <TableCell className="text-right tabular-nums">{rupees(h.paid, true)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", h.incentive - h.paid > 0 && "text-destructive")}>{rupees(h.incentive - h.paid, true)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete"
                    onClick={async () => {
                      if (!confirm("Delete this record (and its cash-book entry)?")) return;
                      await deleteIncentive(h.id);
                      router.refresh();
                    }}
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RecordDialog row={pay} from={from} to={to} modes={modes} onClose={() => setPay(null)} onSaved={() => router.refresh()} />
    </div>
  );
}

function RecordDialog({ row, from, to, modes, onClose, onSaved }: { row: IncentiveRow | null; from: string; to: string; modes: string[]; onClose: () => void; onSaved: () => void }) {
  const [paid, setPaid] = React.useState("");
  const [mode, setMode] = React.useState(modes[0] ?? "Cash");
  const [paidOn, setPaidOn] = React.useState(today());
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (row) {
      setPaid(String(row.record?.paid ?? row.incentive));
      setPaidOn(today());
    }
  }, [row]);
  if (!row) return <Dialog open={false} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Incentive · {row.name}</DialogTitle>
          <DialogDescription>
            {rupees(row.collected)} collected × {pct(row.rate)} = <strong>{rupees(row.incentive, true)}</strong>
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await recordIncentive({ staffId: row.staffId, fromDate: from, toDate: to, paid: Number(paid) || 0, mode, paidOn });
              if (!r.ok) return void toast.error(r.error);
              toast.success("Incentive recorded");
              onSaved();
              onClose();
            });
          }}
        >
          <Field label="Paid now" ml="കൊടുത്തത്" hint="Enter 0 to record it as payable later">
            <Input type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} className="h-11 text-right text-lg font-semibold" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mode">
              <ListSelect items={modes.filter((m) => m !== "Credit (Due)")} value={mode} onChange={(m) => setMode(m ?? "Cash")} />
            </Field>
            <Field label="Paid on">
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
