import Link from "next/link";
import { and, desc, eq, gte, like, sql } from "drizzle-orm";
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
  const owner = can(session.role, "settings");
  const since = new Date(Date.now() - 30 * 86400_000);
  const [customers, lists, merged, sleeveNote, toCheck] = await Promise.all([
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
    // Sleeve notes moved out of Remarks, and the ones left for a person to check
    owner
      ? db
          .select({ summary: schema.auditLog.summary })
          .from(schema.auditLog)
          .where(and(eq(schema.auditLog.entity, "measurement"), like(schema.auditLog.summary, "Sleeve notes:%"), gte(schema.auditLog.at, since)))
          .orderBy(desc(schema.auditLog.at))
          .limit(1)
      : Promise.resolve([]),
    owner
      ? db
          .select({ id: schema.auditLog.entityId, summary: schema.auditLog.summary, customerId: schema.customers.id, customer: schema.customers.name, garment: schema.measurements.garmentType })
          .from(schema.auditLog)
          .innerJoin(schema.measurements, sql`${schema.measurements.id}::text = ${schema.auditLog.entityId}`)
          .innerJoin(schema.customers, eq(schema.customers.id, schema.measurements.customerId))
          .where(and(eq(schema.auditLog.entity, "measurement-check"), gte(schema.auditLog.at, since)))
          .orderBy(schema.customers.name)
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
      {sleeveNote[0] && (
        <div className="mb-3 rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          <p>{sleeveNote[0].summary}.</p>
          {toCheck.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer font-medium text-foreground">Left in Remarks for you to check ({toCheck.length})</summary>
              <ul className="mt-1 grid gap-0.5">
                {toCheck.map((c, i) => (
                  <li key={i}>
                    <Link href={`/customers/${c.customerId}`} className="font-medium text-foreground hover:underline">
                      {c.customer}
                    </Link>{" "}
                    · {c.garment} · {c.summary}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <MeasurementsView
        rows={rows.map((r) => ({ ...r.m, customerName: r.customerName, phone: r.phone }))}
        customers={customers}
        lists={{ customerType: lists.customerType, fit: lists.fit }}
      />
    </>
  );
}
