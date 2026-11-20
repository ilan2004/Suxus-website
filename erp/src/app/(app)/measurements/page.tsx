import { and, desc, eq, gte, like } from "drizzle-orm";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { customerOptions } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { MeasurementsView } from "./measurements-view";

export const metadata = { title: "Measurements" };

export default async function MeasurementsPage() {
  const session = await requireUser();
  const db = await getDb();
  const rows = await db
    .select({
      m: schema.measurements,
      customerName: schema.customers.name,
      phone: schema.customers.phone,
    })
    .from(schema.measurements)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.measurements.customerId))
    .orderBy(desc(schema.measurements.date), desc(schema.measurements.id));
  const [customers, lists, merged] = await Promise.all([
    customerOptions(),
    getSetting("lists"),
    // What the one-time shirt merge did (shown to the Owner for a month)
    can(session.role, "settings")
      ? db
          .select({ summary: schema.auditLog.summary, at: schema.auditLog.at })
          .from(schema.auditLog)
          .where(and(eq(schema.auditLog.entity, "measurement"), like(schema.auditLog.summary, "Shirt merge:%"), gte(schema.auditLog.at, new Date(Date.now() - 30 * 86400_000))))
          .orderBy(desc(schema.auditLog.at))
          .limit(1)
      : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader title="Measurements" ml="അളവുകൾ" description="Saved once per customer and garment — reuse on every order." />
      {merged[0] && (
        <p className="mb-3 rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          Shirt now holds both sleeve lengths in one record — {merged[0].summary?.replace("Shirt merge: ", "")}.
        </p>
      )}
      <MeasurementsView
        rows={rows.map((r) => ({ ...r.m, customerName: r.customerName, phone: r.phone }))}
        customers={customers}
        lists={{ customerType: lists.customerType, fit: lists.fit }}
      />
    </>
  );
}
