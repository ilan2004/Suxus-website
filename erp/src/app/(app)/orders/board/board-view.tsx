"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MoreVertical, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WhatsAppTemplateButton, orderMessageValues } from "@/components/app/whatsapp-template-button";
import { setOrderStatus } from "@/lib/actions/orders";
import { cn } from "@/lib/utils";
import { ScanBundleButton } from "@/components/app/scan-bundle-button";

export type BoardOrder = {
  id: number;
  orderNo: string;
  customerName: string | null;
  customerId: number | null;
  phone: string | null;
  altPhone: string | null;
  itemNames: string;
  items: string;
  pieces: number;
  /** Item lines with who has each (tailor is per item). */
  lines: { item: string; qty: number; tailor: string | null; /** whose garment, when not the customer themself */ wearer?: string | null }[];
  deliveryDate: string | null;
  deliveredOn: string | null;
  status: string;
  urgency: string | null;
  total: number;
  balance: number;
};

const STAGES = [
  { key: "Booked", ml: "ബുക്ക്" },
  { key: "Cut", ml: "കട്ട്" },
  { key: "Stitching", ml: "തയ്യൽ" },
  { key: "Ready", ml: "തയ്യാർ" },
  { key: "Delivered", ml: "കൊടുത്തു" },
] as const;
const RUNNING = ["Booked", "Cut", "Stitching", "Ready"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]}`;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
const TAILOR_KEY = "suxus.board.tailor";

/** late (red) · soon = today/tomorrow (amber) · normal */
function dueState(o: BoardOrder, t: string) {
  if (!o.deliveryDate || o.status === "Delivered") return { kind: "normal" as const, label: o.status === "Delivered" && o.deliveredOn ? `Given ${short(o.deliveredOn)}` : o.deliveryDate ? short(o.deliveryDate) : "No date" };
  const d = dayDiff(o.deliveryDate, t);
  if (d < 0) return { kind: "late" as const, label: `${-d} day${d === -1 ? "" : "s"} late` };
  if (d === 0) return { kind: "soon" as const, label: "Today" };
  if (d === 1) return { kind: "soon" as const, label: "Tomorrow" };
  return { kind: "normal" as const, label: short(o.deliveryDate) };
}

export function OrderBoard({ orders, tailors, today: t, initialTailor, initialDue }: { orders: BoardOrder[]; tailors: string[]; today: string; initialTailor: string | null; initialDue: "today" | "late" | null }) {
  const router = useRouter();
  const [items, setItems] = React.useState(orders);
  React.useEffect(() => setItems(orders), [orders]);
  const [tailor, setTailor] = React.useState<string>(initialTailor ?? "all");
  const [due, setDue] = React.useState(initialDue);
  const [ready, setReady] = React.useState<{ order: BoardOrder; key: number } | null>(null);

  // Each phone remembers whose work it shows (unless the link says otherwise)
  React.useEffect(() => {
    if (initialTailor) return;
    try {
      const saved = localStorage.getItem(TAILOR_KEY);
      if (saved && (saved === "all" || saved === "none" || tailors.includes(saved))) setTailor(saved);
    } catch {}
  }, [initialTailor, tailors]);
  const pickTailor = (v: string) => {
    setTailor(v);
    try {
      localStorage.setItem(TAILOR_KEY, v);
    } catch {}
  };

  // A tailor sees an order when they have at least one item on it; "Not assigned" = orders with an item not given out
  const linesFor = (o: BoardOrder) => (tailor === "all" ? o.lines : o.lines.filter((l) => (tailor === "none" ? !l.tailor : l.tailor === tailor)));
  const mine = items.filter((o) => linesFor(o).length > 0);
  const unassigned = items.filter((o) => RUNNING.includes(o.status)).reduce((n, o) => n + o.lines.filter((l) => !l.tailor).reduce((q, l) => q + l.qty, 0), 0);
  const running = mine.filter((o) => RUNNING.includes(o.status));
  const late = running.filter((o) => o.deliveryDate && o.deliveryDate < t);
  const dueToday = running.filter((o) => o.deliveryDate === t);
  const shown = mine.filter((o) => (due === "late" ? late.includes(o) : due === "today" ? dueToday.includes(o) : true));

  const move = async (o: BoardOrder, to: string) => {
    if (o.status === to) return;
    const from = o.status;
    setItems((xs) => xs.map((x) => (x.id === o.id ? { ...x, status: to, deliveredOn: to === "Delivered" ? t : x.deliveredOn } : x)));
    const r = await setOrderStatus(o.id, to);
    if (!r.ok) {
      setItems((xs) => xs.map((x) => (x.id === o.id ? { ...x, status: from } : x)));
      return void toast.error(r.error);
    }
    toast.success(`${o.orderNo}: ${from} → ${to}`, {
      action: {
        label: "Undo",
        onClick: async () => {
          setItems((xs) => xs.map((x) => (x.id === o.id ? { ...x, status: from } : x)));
          const u = await setOrderStatus(o.id, from);
          if (!u.ok) toast.error(u.error);
          router.refresh();
        },
      },
    });
    if (to === "Ready" && (o.phone || o.altPhone)) setReady({ order: { ...o, status: to }, key: Date.now() });
    router.refresh();
  };

  return (
    <div className="grid gap-3">
      {/* Summary + filters */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ScanBundleButton className="order-last ml-auto sm:order-none" />
        <p className="text-sm">
          <span className="font-semibold">{running.length} orders running</span>
          <span className="text-muted-foreground"> · </span>
          <span className={cn(late.length ? "font-semibold text-destructive" : "text-muted-foreground")}>{late.length} late</span>
          <span className="text-muted-foreground"> · </span>
          <button type="button" onClick={() => pickTailor("none")} className={cn(unassigned ? "font-semibold text-warning hover:underline" : "text-muted-foreground")}>
            {unassigned} piece{unassigned === 1 ? "" : "s"} not assigned
          </button>
        </p>
        {due && (
          <button type="button" onClick={() => setDue(null)} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 text-xs text-primary-foreground">
            {due === "late" ? `Late only · ${late.length}` : `Delivering today · ${dueToday.length}`} <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ v: "all", l: "All" }, ...tailors.map((n) => ({ v: n, l: n })), ...(items.some((o) => o.lines.some((l) => !l.tailor)) ? [{ v: "none", l: "Not assigned" }] : [])].map((f) => (
          <button
            key={f.v}
            type="button"
            onClick={() => pickTailor(f.v)}
            className={cn("h-8 shrink-0 rounded-full border px-3.5 text-sm", tailor === f.v ? "border-primary bg-primary font-medium text-primary-foreground" : "bg-card hover:bg-muted")}
          >
            {f.l}
          </button>
        ))}
      </div>

      {/* Columns: side by side, scroll sideways on phones (one and a bit visible) */}
      <div className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:scroll-px-0 sm:px-0">
        <div className="flex gap-3">
          {STAGES.map((st) => {
            const list = shown
              .filter((o) => o.status === st.key)
              .sort((a, b) => (a.deliveryDate ?? "9999").localeCompare(b.deliveryDate ?? "9999") || a.id - b.id);
            return (
              <section key={st.key} className="flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border bg-muted/40 sm:w-auto sm:max-w-none sm:min-w-[210px] sm:flex-1">
                <h2 className="flex items-baseline justify-between gap-2 px-3 pt-3 pb-2">
                  <span className="text-sm font-semibold">
                    {st.key} <span className="ml">{st.ml}</span>
                  </span>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums">{list.length}</span>
                </h2>
                <div className="grid gap-2 px-2 pb-2">
                  {list.map((o) => (
                    <Card key={o.id} o={o} lines={linesFor(o)} filtered={tailor !== "all"} t={t} onMove={(to) => move(o, to)} />
                  ))}
                  {!list.length && <p className="px-2 py-8 text-center text-xs text-muted-foreground">—</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {ready && (
        <WhatsAppTemplateButton
          key={ready.key}
          variant="none"
          autoOpenKey={ready.key}
          preselect="Order ready"
          title={`${ready.order.orderNo} is ready — tell ${ready.order.customerName ?? "the customer"}?`}
          phone={ready.order.phone}
          altPhone={ready.order.altPhone}
          values={orderMessageValues({ name: ready.order.customerName ?? "", orderNo: ready.order.orderNo, items: ready.order.items, total: ready.order.total, balance: ready.order.balance, deliveryDate: ready.order.deliveryDate })}
          customerId={ready.order.customerId}
          orderId={ready.order.id}
          to={ready.order.customerName ?? ready.order.orderNo}
        />
      )}
    </div>
  );
}

function Card({ o, lines, filtered, t, onMove }: { o: BoardOrder; lines: BoardOrder["lines"]; filtered: boolean; t: string; onMove: (to: string) => void }) {
  const router = useRouter();
  const [menu, setMenu] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = React.useRef(false);
  const openedAt = React.useRef(0);
  const d = dueState(o, t);
  // "Shirt · 2 pcs · Mujeeb" per tailor; when filtered to one tailor, only that tailor's items
  const byTailor = new Map<string, { items: Set<string>; pcs: number }>();
  for (const l of lines) {
    const k = l.tailor ?? "Not assigned";
    const g = byTailor.get(k) ?? { items: new Set<string>(), pcs: 0 };
    g.items.add(l.item);
    g.pcs += l.qty;
    byTailor.set(k, g);
  }
  const whatLines = [...byTailor.entries()].map(([k, g]) => `${[...g.items].join(", ")} · ${g.pcs} pc${g.pcs === 1 ? "" : "s"} · ${k}`);
  const others = filtered ? o.lines.length - lines.length : 0;

  // Press and hold (~0.5 s) opens the stage menu instead of opening the order
  const down = () => {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      openedAt.current = Date.now();
      navigator.vibrate?.(15);
      setMenu(true);
    }, 500);
  };
  const cancel = () => timer.current && clearTimeout(timer.current);

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card shadow-xs transition-shadow select-none hover:shadow-md [-webkit-touch-callout:none]",
        d.kind === "late" && "border-l-4 border-l-destructive",
        d.kind === "soon" && "border-l-4 border-l-warning",
      )}
      onPointerDown={down}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerMove={(e) => (Math.abs(e.movementX) + Math.abs(e.movementY) > 6 ? cancel() : undefined)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Link
        href={`/orders/${o.id}`}
        draggable={false}
        onClick={(e) => {
          if (longPressed.current) e.preventDefault();
        }}
        className="block p-3 pr-9"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[11px] font-medium text-muted-foreground">
            {o.orderNo}
            {o.urgency === "Express" && <Zap className="ml-1 inline size-3 text-warning" />}
          </span>
          <span className={cn("shrink-0 text-xs tabular-nums", d.kind === "late" ? "font-semibold text-destructive" : d.kind === "soon" ? "font-semibold text-warning" : "text-muted-foreground")}>{d.label}</span>
        </div>
        <p className="mt-0.5 truncate text-sm font-semibold">{o.customerName ?? "—"}</p>
        {lines.some((l) => l.wearer)
          ? // Several people's garments: one line per item, the person's name right next to the garment
            lines.map((l, i) => (
              <p key={i} className={cn("truncate text-xs", l.tailor ? "text-muted-foreground" : "text-warning")}>
                {l.qty > 1 && `${l.qty} × `}
                {l.item} — <b className="font-semibold text-foreground">{l.wearer ?? (o.customerName ? `${o.customerName.split(" ")[0]} (self)` : "Self")}</b> · {l.tailor ?? "Not assigned"}
              </p>
            ))
          : whatLines.map((w) => (
              <p key={w} className={cn("truncate text-xs", w.endsWith("Not assigned") ? "text-warning" : "text-muted-foreground")}>
                {w}
              </p>
            ))}
        {others > 0 && <p className="text-[11px] text-muted-foreground/70">+ {others} item{others === 1 ? "" : "s"} with others</p>}
      </Link>
      <DropdownMenu open={menu} onOpenChange={setMenu}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Move ${o.orderNo}`} className="absolute top-1.5 right-1 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted" onPointerDown={(e) => e.stopPropagation()}>
            <MoreVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48"
          // Lifting the finger after a long-press (and the click that follows) must not close the menu it just opened
          onInteractOutside={(e) => {
            if (Date.now() - openedAt.current < 800) e.preventDefault();
          }}
          onFocusOutside={(e) => {
            if (Date.now() - openedAt.current < 800) e.preventDefault();
          }}
        >
          <DropdownMenuLabel className="text-xs">Move {o.orderNo} to</DropdownMenuLabel>
          {STAGES.map((s) => (
            <DropdownMenuItem key={s.key} disabled={s.key === o.status} onSelect={() => onMove(s.key)}>
              {s.key === o.status ? <Check className="size-4" /> : <span className="size-4" />} {s.key} <span className="ml ml-auto">{s.ml}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push(`/orders/${o.id}`)}>Open order</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
