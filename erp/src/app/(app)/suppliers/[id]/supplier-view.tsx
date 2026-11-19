"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleDollarSign, Copy, Landmark, Pencil, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/app/stat-card";
import { SupplierPayDialog } from "@/components/forms/supplier-pay-dialog";
import { SupplierDialog } from "@/components/forms/supplier-dialog";
import { deleteSupplier, deleteSupplierPayment } from "@/lib/actions/purchases";
import type { PurchaseRow, SupplierRow } from "@/lib/queries";
import { fmtDate, rupees } from "@/lib/utils";

type Pay = { id: number; date: string; amount: number; mode: string; ref: string | null; paidBy: string | null; note: string | null; createdBy?: string | null };
type Setup = { id: number; date: string; category: string; description: string | null; paidBy: string; amount: number; mode: string | null; billNo: string | null };

export function SupplierView({
  supplier: s,
  purchases,
  payments,
  setup,
  partners,
  isPartner,
  showMoney,
  showCosts,
}: {
  supplier: SupplierRow;
  purchases: PurchaseRow[];
  payments: Pay[];
  setup: Setup[];
  partners: string[];
  isPartner: boolean;
  /** Balance due, payments, Pay button, setup expenses (Owner). */
  showMoney: boolean;
  /** Purchase amounts. */
  showCosts: boolean;
}) {
  const router = useRouter();
  const credit = setup.filter((x) => x.mode === "Credit (Due)");
  const [pay, setPay] = React.useState(false);
  const [edit, setEdit] = React.useState(false);
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copied"));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/suppliers" aria-label="Back">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-semibold">{s.name}</h1>
        {s.type && <Badge variant="secondary">{s.type}</Badge>}
        <div className="ml-auto flex gap-2">
          {showMoney && (
            <Button onClick={() => setPay(true)}>
              <CircleDollarSign /> Pay supplier
            </Button>
          )}
          <Button variant="outline" onClick={() => setEdit(true)}>
            <Pencil /> Edit
          </Button>
          {isPartner && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
              onClick={async () => {
                if (!confirm(`Delete ${s.name}?`)) return;
                const r = await deleteSupplier(s.id);
                if (!r.ok) return void toast.error(r.error);
                router.push("/suppliers");
              }}
            >
              <Trash2 className="text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Phone" icon={Phone} value={s.phone} onCopy={copy} />
        <Detail label="UPI ID" value={s.upi} onCopy={copy} />
        <Detail label="Bank A/c & IFSC" icon={Landmark} value={s.bank} onCopy={copy} />
        <Detail label="GST no." value={s.gstNo} onCopy={copy} />
        <Detail label="Place" value={s.place} />
        <Detail label="Supplies" value={s.supplies} />
        <Detail label="Other names (GPay / nickname)" value={s.aliases} />
        {s.notes && (
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="mt-0.5 whitespace-pre-line">{s.notes}</p>
          </div>
        )}
      </div>

      {showMoney && (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Taken on credit" ml="കടമായി വാങ്ങിയത്" value={rupees(s.owed)} sub={`${s.openingBalance ? `Opening ${rupees(s.openingBalance)} · ` : ""}Purchases ${rupees(s.billed)} · Setup on credit ${rupees(s.setupCredit)}`} />
        <StatCard label="Paid on account" ml="കൊടുത്തത്" value={rupees(s.paid)} sub={`${payments.length} payment(s)`} tone="success" />
        <StatCard
          label="Balance due"
          ml="കൊടുക്കാനുള്ളത്"
          value={s.balance < 0 ? `${rupees(-s.balance)} adv.` : rupees(s.balance)}
          tone={s.balance > 0 ? "destructive" : "success"}
          sub={
            s.balance > 0 ? (
              <Button size="sm" className="mt-1.5 h-7 px-2.5" onClick={() => setPay(true)}>
                <CircleDollarSign className="size-3.5" /> Pay
              </Button>
            ) : s.balance < 0 ? (
              "Paid in advance"
            ) : undefined
          }
        />
        <StatCard label="Paid on the spot" ml="ഉടനെ കൊടുത്തത്" value={rupees(s.setupPaid)} sub="Setup items not on credit" tone="gold" />
      </div>
      )}

      <Tabs defaultValue={purchases.length || !showMoney ? "purchases" : credit.length ? "payments" : "setup"}>
        <TabsList>
          <TabsTrigger value="purchases">{showMoney ? "Purchases" : "What was bought"} ({purchases.length})</TabsTrigger>
          {showMoney && <TabsTrigger value="payments">Payments on account ({payments.length})</TabsTrigger>}
          {showMoney && <TabsTrigger value="setup">Setup expenses ({setup.length}{credit.length ? ` · ${credit.length} on credit` : ""})</TabsTrigger>}
        </TabsList>
        <TabsContent value="purchases">
          {showCosts ? (
            <SimpleTable
              head={["Date", "Bill no.", "Description", "Total", "Paid then"]}
              rows={purchases.map((p) => [fmtDate(p.date), p.invoiceNo, p.description, rupees(p.total, true), rupees(p.paid)])}
              align={[3, 4]}
            />
          ) : (
            <SimpleTable head={["Date", "Bill no.", "Description", "Qty"]} rows={purchases.map((p) => [fmtDate(p.date), p.invoiceNo, p.description, p.qty])} align={[3]} />
          )}
        </TabsContent>
        <TabsContent value="payments">
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>UPI / Ref</TableHead>
                  <TableHead>Paid by</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                      No payments yet
                    </TableCell>
                  </TableRow>
                )}
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{fmtDate(p.date)}</TableCell>
                    <TableCell>{p.mode}</TableCell>
                    <TableCell className="font-mono text-xs">{p.ref}</TableCell>
                    <TableCell>
                      {p.paidBy ?? <span className="text-xs text-muted-foreground">from Excel</span>}
                      {p.createdBy && <span className="block text-[11px] text-muted-foreground">entered by {p.createdBy}</span>}
                    </TableCell>
                    <TableCell className="max-w-72 truncate">{p.note}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{rupees(p.amount, true)}</TableCell>
                    <TableCell className="text-right">
                      {isPartner && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete"
                          onClick={async () => {
                            if (!confirm(`Delete this payment?\n\n${fmtDate(p.date)} · ${rupees(p.amount, true)} · ${p.mode}${p.ref ? ` · ${p.ref}` : ""}`)) return;
                            const r = await deleteSupplierPayment(p.id);
                            if (!r.ok) return void toast.error(r.error);
                            toast.success("Payment deleted");
                            router.refresh();
                          }}
                        >
                          <Trash2 className="text-muted-foreground" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="setup">
          <SimpleTable
            head={["Date", "Category", "Description", "Paid by", "Mode", "Amount"]}
            rows={setup.map((x) => [fmtDate(x.date), x.category, x.description, x.paidBy, x.mode, rupees(x.amount, true)])}
            align={[5]}
          />
        </TabsContent>
      </Tabs>

      {showMoney && (
      <SupplierPayDialog
        supplier={{ id: s.id, name: s.name, balance: s.balance, phone: s.phone, upi: s.upi, bank: s.bank, lastMode: s.lastMode }}
        open={pay}
        onOpenChange={setPay}
        payers={["Business Account", ...partners.filter((p) => p !== "Business Account")]}
      />
      )}
      <SupplierDialog
        value={edit ? { id: s.id, name: s.name, type: s.type, place: s.place, phone: s.phone, upi: s.upi, bank: s.bank, gstNo: s.gstNo, supplies: s.supplies, aliases: s.aliases, openingBalance: s.openingBalance, notes: s.notes } : null}
        onClose={() => setEdit(false)}
        onSaved={() => router.refresh()}
        showMoney={showMoney}
      />
    </div>
  );
}

function Detail({ label, value, icon: Icon, onCopy }: { label: string; value: string | null; icon?: React.ComponentType<{ className?: string }>; onCopy?: (t: string) => void }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {Icon && value && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
        <span className="truncate font-medium">{value || "—"}</span>
        {value && onCopy && (
          <button onClick={() => onCopy(value)} className="text-muted-foreground hover:text-foreground" aria-label={`Copy ${label}`}>
            <Copy className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function SimpleTable({ head, rows, align = [] }: { head: string[]; rows: React.ReactNode[][]; align?: number[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((h, i) => (
              <TableHead key={h} className={align.includes(i) ? "text-right" : ""}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={head.length} className="h-20 text-center text-muted-foreground">
                Nothing yet
              </TableCell>
            </TableRow>
          )}
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((c, j) => (
                <TableCell key={j} className={align.includes(j) ? "text-right tabular-nums" : "max-w-72 truncate"}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
