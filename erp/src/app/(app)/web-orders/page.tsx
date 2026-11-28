import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { features } from "@/lib/db/features";
import { webOrderList } from "@/lib/web-orders";
import { formatPhone } from "@/lib/phone";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

export const metadata = { title: "Website orders" };

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
const STATUS: Record<string, { en: string; cls: string }> = {
  new: { en: "New", cls: "bg-primary text-primary-foreground" },
  confirmed: { en: "Confirmed", cls: "bg-success/15 text-success" },
  cancelled: { en: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

/** Orders placed on suxus.shop/order: shirt / pant in our fabric, the customer's own garment measurements, courier. */
export default async function WebOrdersPage() {
  await requireUser();
  const rows = (await features()).webOrders ? await webOrderList() : [];
  const fresh = rows.filter((r) => r.status === "new").length;
  return (
    <>
      <PageHeader title="Website orders" ml="വെബ്സൈറ്റ് ഓർഡർ" description={`Orders from suxus.shop — call or WhatsApp to confirm, then send by courier. ${fresh} new.`} />
      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No website orders yet.</p>
      ) : (
        <div className="grid gap-2" data-testid="web-orders">
          {rows.map((r) => (
            <Link key={r.id} href={`/web-orders/${r.id}`} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card p-3 hover:bg-accent", r.status === "cancelled" && "opacity-60")}>
              <span className="font-mono text-sm text-muted-foreground">#{r.id}</span>
              <span className="min-w-0 flex-1">
                <b>{r.name}</b> <span className="tabular-nums text-muted-foreground">{formatPhone(r.phone)}</span>
                <span className="block truncate text-sm">
                  {r.items.map((i) => `${i.qty > 1 ? `${i.qty} × ` : ""}${i.garment}${i.garment === "Shirt" ? ` (${i.sleeve} sleeve)` : ` (${i.model})`} ${i.fabricCode}`).join(" · ")}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {when(r.createdAt)} · PIN {r.pincode}
              </span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS[r.status]?.cls)}>{STATUS[r.status]?.en ?? r.status}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
