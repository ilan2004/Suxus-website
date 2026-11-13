"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Banknote, Link2, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/app/field";
import { ListSelect } from "@/components/app/search-select";
import { StatCard } from "@/components/app/stat-card";
import { deleteCashEntry, saveCashEntry, type CashInput } from "@/lib/actions/cash";
import { addDays, cn, fmtDate, monthStart, rupees, today } from "@/lib/utils";

type Row = {
  id: number;
  date: string;
  particulars: string;
  category: string;
  amountIn: number;
  amountOut: number;
  mode: string;
  partner: string | null;
  remarks: string | null;
  source: string | null;
  sourceId: number | null;
  href: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  sale: "Fabric bill",
  payment: "Payment",
  purchase: "Purchase",
  supplier_payment: "Supplier",
  wage: "Wage",
  wage_payment: "Wages",
  setup: "Setup",
  incentive: "Incentive",
};

function lastMonth() {
  const t = today();
  const firstThis = monthStart(t);
  const lastDayPrev = addDays(firstThis, -1);
  return [monthStart(lastDayPrev), lastDayPrev] as const;
}

export function CashBookView({
  rows,
  categories,
  modes,
  partners,
  canDelete,
  initial = {},
}: {
  initial?: { from?: string; to?: string; category?: string; mode?: string };
  rows: Row[];
  categories: string[];
  modes: string[];
  partners: string[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const t = today();
  const okDate = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const [from, setFrom] = React.useState(okDate(initial.from) ?? monthStart(t));
  const [to, setTo] = React.useState(okDate(initial.to) ?? t);
  const [category, setCategory] = React.useState<string | null>(initial.category ?? null);
  const [mode, setMode] = React.useState<"all" | "cash" | "bank">(initial.mode === "cash" || initial.mode === "bank" ? initial.mode : "all");
  const [q, setQ] = React.useState("");
  const [edit, setEdit] = React.useState<CashInput | null>(null);

  // Running balance over every entry in date order (like the Excel)
  const withBalance = React.useMemo(() => {
    let bal = 0;
    let cash = 0;
    return rows.map((r) => {
      bal += r.amountIn - r.amountOut;
      if (r.mode === "Cash") cash += r.amountIn - r.amountOut;
      return { ...r, balance: Math.round(bal * 100) / 100, cash: Math.round(cash * 100) / 100 };
    });
  }, [rows]);

  const modeOk = (r: Row) => (mode === "all" ? true : mode === "cash" ? r.mode === "Cash" : r.mode !== "Cash");
  const opening = withBalance.filter((r) => r.date < from).reduce((s, r) => s + r.amountIn - r.amountOut, 0);
  const inRange = withBalance.filter((r) => r.date >= from && r.date <= to);
  const visible = inRange.filter(
    (r) => modeOk(r) && (!category || r.category === category) && (!q || `${r.particulars} ${r.remarks ?? ""} ${r.category}`.toLowerCase().includes(q.toLowerCase())),
  );
  const totIn = inRange.reduce((s, r) => s + r.amountIn, 0);
  const totOut = inRange.reduce((s, r) => s + r.amountOut, 0);
  const cashInHand = withBalance.filter((r) => r.date <= to).reduce((s, r) => s + (r.mode === "Cash" ? r.amountIn - r.amountOut : 0), 0);

  const presets: [string, string, string][] = [
    ["Today", t, t],
    ["This month", monthStart(t), t],
    ["Last month", ...lastMonth()],
    ["All", rows[0]?.date ?? t, t],
  ];

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Opening balance" ml="തുടക്ക ബാക്കി" value={rupees(opening)} sub={`before ${fmtDate(from)}`} icon={Wallet} />
        <StatCard label="Money in" ml="വരവ്" value={rupees(totIn)} icon={ArrowDownLeft} tone="success" />
        <StatCard label="Money out" ml="ചെലവ്" value={rupees(totOut)} icon={ArrowUpRight} tone="destructive" />
        <StatCard label="Cash in hand" ml="കയ്യിലുള്ള പണം" value={rupees(cashInHand)} sub={`Closing (all modes) ${rupees(opening + totIn - totOut)}`} icon={Banknote} tone="gold" />
      </div>

      <div className="flex flex-col flex-wrap gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-1.5">
          {presets.map(([label, f, tt]) => (
            <Button key={label} size="sm" variant={from === f && to === tt ? "default" : "outline"} onClick={() => (setFrom(f), setTo(tt))}>
              {label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" />
          <span className="text-muted-foreground">→</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" />
        </div>
        <div className="inline-flex rounded-md border bg-muted p-0.5 text-xs">
          {(
            [
              ["all", "All modes"],
              ["cash", "Cash"],
              ["bank", "Bank / UPI"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={cn("h-7 rounded px-2.5 whitespace-nowrap", mode === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
              {l}
            </button>
          ))}
        </div>
        <ListSelect items={categories} value={category} onChange={setCategory} placeholder="All categories" allowClear className="h-8 md:w-48" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 md:w-40" />
        <Button className="md:ml-auto" onClick={() => setEdit({ date: t, particulars: "", category: "Other Expense", amountIn: 0, amountOut: 0, mode: "Cash" })}>
          <Plus /> Add entry
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Particulars</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">In ₹</TableHead>
              <TableHead className="text-right">Out ₹</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No entries in this period.
                </TableCell>
              </TableRow>
            )}
            {[...visible].reverse().map((r) => (
              <TableRow
                key={r.id}
                className={cn(!r.source && "cursor-pointer")}
                onClick={() =>
                  !r.source &&
                  setEdit({ id: r.id, date: r.date, particulars: r.particulars, category: r.category, amountIn: r.amountIn, amountOut: r.amountOut, mode: r.mode, partner: r.partner, remarks: r.remarks })
                }
              >
                <TableCell>{fmtDate(r.date)}</TableCell>
                <TableCell className="max-w-80 whitespace-normal">
                  <div className="font-medium">{r.particulars}</div>
                  {(r.remarks || r.partner) && <div className="text-xs text-muted-foreground">{[r.partner, r.remarks].filter(Boolean).join(" · ")}</div>}
                </TableCell>
                <TableCell>
                  <span className="text-xs">{r.category}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.mode}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-success">{r.amountIn ? rupees(r.amountIn, true) : ""}</TableCell>
                <TableCell className="text-right font-medium tabular-nums text-destructive">{r.amountOut ? rupees(r.amountOut, true) : ""}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{rupees(r.balance)}</TableCell>
                <TableCell className="text-right">
                  {r.source ? (
                    r.href ? (
                      <Link href={r.href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" title="Automatic entry — open source">
                        <Link2 className="size-3.5" /> {SOURCE_LABEL[r.source] ?? r.source}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">{SOURCE_LABEL[r.source] ?? "Auto"}</span>
                    )
                  ) : canDelete ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("Delete this entry?")) return;
                        const res = await deleteCashEntry(r.id);
                        if (!res.ok) return void toast.error(res.error);
                        router.refresh();
                      }}
                    >
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {visible.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>{visible.length} entries</TableCell>
                <TableCell className="text-right tabular-nums">{rupees(visible.reduce((s, r) => s + r.amountIn, 0))}</TableCell>
                <TableCell className="text-right tabular-nums">{rupees(visible.reduce((s, r) => s + r.amountOut, 0))}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <CashDialog value={edit} onClose={() => setEdit(null)} categories={categories} modes={modes} partners={partners} onSaved={() => router.refresh()} />
    </div>
  );
}

const INCOME = ["Fabric Sale", "Stitching Income", "Alteration Income", "Bulk Order Income", "Advance Received", "Capital Introduced"];

function CashDialog({
  value,
  onClose,
  categories,
  modes,
  partners,
  onSaved,
}: {
  value: CashInput | null;
  onClose: () => void;
  categories: string[];
  modes: string[];
  partners: string[];
  onSaved: () => void;
}) {
  const [v, setV] = React.useState<CashInput | null>(value);
  const [dir, setDir] = React.useState<"in" | "out">("out");
  const [amount, setAmount] = React.useState("");
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    setV(value);
    if (value) {
      const isIn = Number(value.amountIn) > 0;
      setDir(isIn ? "in" : "out");
      setAmount(String((isIn ? value.amountIn : value.amountOut) || ""));
    }
  }, [value]);
  if (!v) return <Dialog open={false} />;
  const needsPartner = ["Capital Introduced", "Owner Withdrawal"].includes(v.category);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = Number(amount) || 0;
    start(async () => {
      const r = await saveCashEntry({ ...v, amountIn: dir === "in" ? a : 0, amountOut: dir === "out" ? a : 0, partner: needsPartner ? v.partner : null });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      onSaved();
      onClose();
    });
  };

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{v.id ? "Edit entry" : "New cash-book entry"}</DialogTitle>
          <DialogDescription>Rent, electricity, transport, capital introduced, owner withdrawal …</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted p-1">
            {(
              [
                ["in", "Money in · വരവ്"],
                ["out", "Money out · ചെലവ്"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDir(k)}
                className={cn("h-9 rounded-md text-sm", dir === k ? (k === "in" ? "bg-success text-white" : "bg-destructive text-white") : "text-muted-foreground")}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" ml="തുക" required>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 text-right text-lg font-semibold" autoFocus required />
            </Field>
            <Field label="Date" ml="തീയതി">
              <Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className="h-11" />
            </Field>
            <Field label="Particulars" ml="വിവരണം" required className="sm:col-span-2">
              <Input value={v.particulars} onChange={(e) => setV({ ...v, particulars: e.target.value })} placeholder="e.g. Shop rent — November" required />
            </Field>
            <Field label="Category" ml="വിഭാഗം">
              <ListSelect
                items={dir === "in" ? categories.filter((c) => INCOME.includes(c) || !categories.includes(c)) : categories.filter((c) => !INCOME.includes(c) || c === "Capital Introduced")}
                value={v.category}
                onChange={(c) => setV({ ...v, category: c ?? "Other Expense" })}
              />
            </Field>
            <Field label="Mode" ml="രീതി">
              <ListSelect items={modes.filter((m) => m !== "Credit (Due)")} value={v.mode} onChange={(m) => setV({ ...v, mode: m ?? "Cash" })} />
            </Field>
            {needsPartner && (
              <Field label="Partner" ml="പാർട്ണർ" required className="sm:col-span-2">
                <ListSelect items={partners} value={v.partner} onChange={(p) => setV({ ...v, partner: p })} />
              </Field>
            )}
            <Field label="Remarks" ml="കുറിപ്പ്" className="sm:col-span-2">
              <Textarea value={v.remarks ?? ""} onChange={(e) => setV({ ...v, remarks: e.target.value })} rows={2} />
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
