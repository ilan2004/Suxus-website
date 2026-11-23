"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Scissors, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, type ColumnDef } from "@/components/app/data-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { Field } from "@/components/app/field";
import { ListSelect, SearchSelect } from "@/components/app/search-select";
import { PayDialog } from "@/components/forms/pay-dialog";
import { deleteWage, deleteWagePayment, payTailor, saveWages } from "@/lib/actions/wages";
import { cn, fmtDate, monthStart, round2, rupees, today } from "@/lib/utils";

type Wage = { id: number; date: string; tailorId: number; tailorName: string; orderNo: string | null; item: string; qty: number; rate: number; amount: number; paid: number; remarks: string | null };
type Payment = { id: number; date: string; tailorId: number; tailorName: string; amount: number; mode: string; note: string | null };
type Tailor = { id: number; name: string; role: string | null; pieceRate: number | null; earned: number; paid: number; balance: number };
type Pending = { id: number; orderNo: string; date: string; status: string; customerName: string | null; tailorId: number | null; items: { item: string; qty: number }[] };
type Draft = { tailorId: number | null; date: string; orderNo: string; lines: { key: string; item: string; qty: string; rate: string }[]; paid: string; paidMode: string };

export function WagesView({
  wages,
  payments,
  tailors,
  allStaff,
  pending,
  items,
  rates,
  modes,
  canDelete,
}: {
  wages: Wage[];
  payments: Payment[];
  tailors: Tailor[];
  allStaff: { id: number; name: string; pieceRate: number | null }[];
  pending: Pending[];
  items: string[];
  rates: Record<string, number>;
  modes: string[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [payFor, setPayFor] = React.useState<Tailor | null>(null);
  const [filter, setFilter] = React.useState<number | null>(null);
  const ms = monthStart();

  /** Piece Rate Master first, then the tailor's own piece rate. */
  const rateFor = (item: string, tailorId: number | null) => rates[item] ?? allStaff.find((s) => s.id === tailorId)?.pieceRate ?? 0;
  const line = (item: string, qty: number, tailorId: number | null) => ({ key: crypto.randomUUID(), item, qty: String(qty), rate: String(rateFor(item, tailorId)) });

  const fromOrder = (o: Pending) =>
    setDraft({ tailorId: o.tailorId, date: today(), orderNo: o.orderNo, lines: o.items.map((i) => line(i.item, i.qty, o.tailorId)), paid: "", paidMode: modes[0] ?? "Cash" });

  const shown = wages.filter((w) => !filter || w.tailorId === filter);
  const columns: ColumnDef<Wage>[] = [
    { accessorKey: "date", header: "Date", cell: ({ row }) => fmtDate(row.original.date) },
    {
      accessorKey: "tailorName",
      header: "Tailor",
      cell: ({ row }) => (
        <Link href={`/staff/${row.original.tailorId}`} className="font-medium hover:underline">
          {row.original.tailorName}
        </Link>
      ),
    },
    {
      accessorKey: "orderNo",
      header: "Order",
      cell: ({ row }) =>
        row.original.orderNo ? (
          <Link href={`/go/${row.original.orderNo}`} className="font-mono text-xs hover:underline">
            {row.original.orderNo}
          </Link>
        ) : null,
    },
    { accessorKey: "item", header: "Item" },
    { accessorKey: "qty", header: "Qty", meta: { align: "right" } },
    { accessorKey: "rate", header: "Rate", meta: { align: "right" }, cell: ({ row }) => rupees(row.original.rate) },
    { accessorKey: "amount", header: "Amount", meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{rupees(row.original.amount)}</span> },
    { accessorKey: "paid", header: "Paid then", meta: { align: "right" }, cell: ({ row }) => (row.original.paid ? rupees(row.original.paid) : "—") },
    {
      id: "del",
      header: "",
      cell: ({ row }) =>
        canDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete"
            onClick={async () => {
              if (!confirm("Delete this wage line?")) return;
              await deleteWage(row.original.id);
              router.refresh();
            }}
          >
            <Trash2 className="text-muted-foreground" />
          </Button>
        ),
    },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tailors.map((t) => {
          const month = wages.filter((w) => w.tailorId === t.id && w.date >= ms);
          return (
            <div key={t.id} className={cn("rounded-xl border bg-card p-4 transition-colors", filter === t.id && "border-primary ring-2 ring-primary/15")}>
              <button className="w-full text-left" onClick={() => setFilter(filter === t.id ? null : t.id)}>
                <div className="flex items-center justify-between">
                  <p className="font-medium">{t.name}</p>
                  <span className="text-xs text-muted-foreground">{t.role}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">This month: {month.reduce((s, w) => s + w.qty, 0)} pcs · {rupees(month.reduce((s, w) => s + w.amount, 0))}</p>
                <p className="mt-1 text-xs text-muted-foreground">Balance due</p>
                <p className={cn("font-display text-2xl font-semibold tabular-nums", t.balance > 0 ? "text-destructive" : "text-success")}>{rupees(t.balance)}</p>
              </button>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setPayFor(t)}>
                <Wallet /> Pay {t.name.split(" ")[0]}
              </Button>
            </div>
          );
        })}
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-gold/50 bg-gold/5 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Scissors className="size-4 text-[#8a6a2a] dark:text-gold" /> Finished orders without a wage entry ({pending.length}) <span className="ml">കൂലി ചേർക്കാനുള്ളവ</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {pending.map((o) => (
              <button key={`${o.id}-${o.tailorId}`} onClick={() => fromOrder(o)} className="rounded-lg border bg-card px-3 py-2 text-left text-sm hover:border-primary/50">
                <span className="font-mono text-xs text-muted-foreground">{o.orderNo}</span> · {allStaff.find((s) => s.id === o.tailorId)?.name}{" "}
                <Link href={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="text-xs text-primary underline">
                  open
                </Link>
                <span className="block text-xs text-muted-foreground">{o.items.map((i) => `${i.qty}×${i.item}`).join(", ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="wages">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="wages">Work done</TabsTrigger>
            <TabsTrigger value="payments">Payouts ({payments.length})</TabsTrigger>
          </TabsList>
          {filter && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilter(null)}>
              {tailors.find((t) => t.id === filter)?.name} ✕
            </Badge>
          )}
        </div>
        <TabsContent value="wages">
          <DataTable
            columns={columns}
            data={shown}
            searchPlaceholder="Search tailor, order, item…"
            toolbar={
              <Button onClick={() => setDraft({ tailorId: filter, date: today(), orderNo: "", lines: [line("Shirt", 1, filter)], paid: "", paidMode: modes[0] ?? "Cash" })}>
                <Plus /> Add work
              </Button>
            }
            footer={(rs) => (
              <TableRow>
                <TableCell colSpan={4}>{rs.length} lines</TableCell>
                <TableCell className="text-right">{rs.reduce((s, r) => s + r.qty, 0)}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + r.amount, 0))}</TableCell>
                <TableCell className="text-right tabular-nums">{rupees(rs.reduce((s, r) => s + r.paid, 0))}</TableCell>
                <TableCell />
              </TableRow>
            )}
            empty="No wage entries yet."
          />
        </TabsContent>
        <TabsContent value="payments">
          <div className="overflow-hidden rounded-xl border bg-card">
            <ul className="divide-y">
              {payments.filter((p) => !filter || p.tailorId === filter).length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No payouts yet</li>}
              {payments
                .filter((p) => !filter || p.tailorId === filter)
                .map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{p.tailorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(p.date)} · {p.mode}
                        {p.note && ` · ${p.note}`}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">{rupees(p.amount, true)}</span>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        onClick={async () => {
                          if (!confirm("Delete this payout?")) return;
                          await deleteWagePayment(p.id);
                          router.refresh();
                        }}
                      >
                        <Trash2 className="text-muted-foreground" />
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      <WageDialog draft={draft} setDraft={setDraft} staff={allStaff} items={items} rateFor={rateFor} modes={modes} onSaved={() => router.refresh()} />
      <PayDialog
        open={!!payFor}
        onOpenChange={(o) => !o && setPayFor(null)}
        title={`Pay ${payFor?.name ?? ""}`}
        description="Wage payout — goes to the cash book as Tailor Wages"
        suggested={payFor?.balance}
        modes={modes}
        onSubmit={(v) => payTailor({ tailorId: payFor!.id, ...v })}
        onDone={() => router.refresh()}
      />
      <p className="text-xs text-muted-foreground">
        Rates come from <Link href="/settings" className="underline">Settings → Piece rates</Link>, otherwise from the tailor&apos;s own piece rate on the Staff page.
      </p>
    </div>
  );
}

function WageDialog({
  draft,
  setDraft,
  staff,
  items,
  rateFor,
  modes,
  onSaved,
}: {
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  staff: { id: number; name: string }[];
  items: string[];
  rateFor: (item: string, tailorId: number | null) => number;
  modes: string[];
  onSaved: () => void;
}) {
  const [pending, start] = React.useTransition();
  if (!draft) return <Dialog open={false} />;
  const d = draft;
  const set = (p: Partial<Draft>) => setDraft({ ...d, ...p });
  const upd = (key: string, p: Partial<Draft["lines"][number]>) => set({ lines: d.lines.map((l) => (l.key === key ? { ...l, ...p } : l)) });
  const total = round2(d.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.tailorId) return void toast.error("Choose the tailor");
    start(async () => {
      const r = await saveWages({
        tailorId: d.tailorId!,
        date: d.date,
        orderNo: d.orderNo || null,
        lines: d.lines.map((l) => ({ item: l.item, qty: Number(l.qty), rate: Number(l.rate) || 0 })),
        paid: Number(d.paid) || 0,
        paidMode: d.paidMode,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Wage added");
      onSaved();
      setDraft(null);
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && setDraft(null)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add work done</DialogTitle>
          <DialogDescription>ആര് എത്ര പീസ് തുന്നി</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tailor" ml="തയ്യൽക്കാരൻ" required>
              <SearchSelect
                options={staff.map((s) => ({ value: String(s.id), label: s.name }))}
                value={d.tailorId ? String(d.tailorId) : null}
                onChange={(x) => {
                  const id = x ? Number(x) : null;
                  set({ tailorId: id, lines: d.lines.map((l) => ({ ...l, rate: String(rateFor(l.item, id)) })) });
                }}
              />
            </Field>
            <Field label="Date" ml="തീയതി">
              <Input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="Order no." ml="ഓർഡർ നം.">
              <Input value={d.orderNo} onChange={(e) => set({ orderNo: e.target.value })} placeholder="SO-0001" />
            </Field>
          </div>
          <div className="grid gap-2">
            {d.lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[1fr_70px_90px_80px_32px] items-center gap-2">
                <ListSelect items={items} value={l.item} onChange={(x) => upd(l.key, { item: x ?? "", rate: String(rateFor(x ?? "", d.tailorId)) })} />
                <Input type="number" min={1} value={l.qty} onChange={(e) => upd(l.key, { qty: e.target.value })} className="text-right" />
                <Input type="number" min={0} value={l.rate} onChange={(e) => upd(l.key, { rate: e.target.value })} className="text-right" />
                <span className="text-right text-sm font-medium tabular-nums">{rupees((Number(l.qty) || 0) * (Number(l.rate) || 0))}</span>
                <Button type="button" variant="ghost" size="icon-sm" disabled={d.lines.length === 1} onClick={() => set({ lines: d.lines.filter((x) => x.key !== l.key) })} aria-label="Remove">
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => set({ lines: [...d.lines, { key: crypto.randomUUID(), item: "Pant", qty: "1", rate: String(rateFor("Pant", d.tailorId)) }] })}>
              <Plus /> Item
            </Button>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-muted/50 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Wage total</p>
              <p className="font-display text-xl font-semibold tabular-nums">{rupees(total, true)}</p>
            </div>
            <div className="flex items-end gap-2">
              <Field label="Paid now (optional)">
                <Input type="number" min={0} value={d.paid} onChange={(e) => set({ paid: e.target.value })} className="w-28 text-right" placeholder="0" />
              </Field>
              <ListSelect items={modes.filter((m) => m !== "Credit (Due)")} value={d.paidMode} onChange={(m) => set({ paidMode: m ?? "Cash" })} className="w-32" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
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
