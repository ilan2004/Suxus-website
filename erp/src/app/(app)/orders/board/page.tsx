import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { ordersWithBalance } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { addDays, today } from "@/lib/utils";
import { OrderBoard } from "./board-view";

export const metadata = { title: "Order board" };

export default async function OrderBoardPage({ searchParams }: { searchParams: Promise<{ tailor?: string; due?: string }> }) {
  await requireUser();
  const t = today();
  const weekAgo = addDays(t, -6); // delivered orders stay on the board for 7 days
  const db = await getDb();
  const [all, staff, sp] = await Promise.all([
    ordersWithBalance(),
    db.select({ name: schema.staff.name, role: schema.staff.role }).from(schema.staff).where(eq(schema.staff.status, "Active")),
    searchParams,
  ]);
  const orders = all.filter((o) => o.status !== "Cancelled" && (o.status !== "Delivered" || (o.deliveredOn ?? o.date) >= weekAgo));
  // Tailor filter: everyone who stitches, plus anyone an order is assigned to
  const tailors = [...new Set([...staff.filter((s) => /tailor|cutting|stitch/i.test(s.role ?? "")).map((s) => s.name), ...orders.flatMap((o) => o.itemTailors.map((l) => l.tailor)).filter((n): n is string => !!n)])].sort();
  return (
    <>
      <PageHeader title="Order board" ml="ഓർഡർ ബോർഡ്" description="Every stitching order and the stage it is at. Tap ⋯ (or press and hold a card) to move it." />
      <OrderBoard
        orders={orders.map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          customerName: o.customerName,
          customerId: o.customerId,
          phone: o.phone,
          altPhone: o.altPhone,
          itemNames: o.itemNames,
          items: o.items,
          pieces: o.pieces,
          lines: o.itemTailors.map((l) => ({ item: l.item, qty: l.qty, tailor: l.tailor, wearer: l.wearer })),
          deliveryDate: o.deliveryDate,
          deliveredOn: o.deliveredOn,
          status: o.status,
          urgency: o.urgency,
          total: o.total,
          balance: o.balance,
        }))}
        tailors={tailors}
        today={t}
        initialTailor={sp.tailor ?? null}
        initialDue={sp.due === "today" || sp.due === "late" ? sp.due : null}
      />
    </>
  );
}
