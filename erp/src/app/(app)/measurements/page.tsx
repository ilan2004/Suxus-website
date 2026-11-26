import Link from "next/link";
import { and, desc, eq, gte, isNotNull, like, ne, sql } from "drizzle-orm";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { customerOptions } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { MeasurementsView } from "./measurements-view";
import { SimpleMeasurements } from "./simple/simple-view";
import { SimpleSwitch } from "./simple/switch";
import { getSettings } from "@/lib/settings";
import { col, when } from "@/lib/db/ext";
import { features } from "@/lib/db/features";

export const metadata = { title: "Measurements" };

export default async function MeasurementsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await requireUser();
  const db = await getDb();
  const { view } = await searchParams;
  // Newer features this database can serve (each switches off on its own if its update has not run)
  const feat = await features();
  const rows = await db
    .select({
      m: schema.measurements,
      wearerId: when(feat.wearers, col.measurementWearer),
      customerName: schema.customers.name,
      phone: schema.customers.phone,
    })
    .from(schema.measurements)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.measurements.customerId))
    .orderBy(desc(schema.measurements.date), desc(schema.measurements.id));
  // Every wearer (people measured under a customer) — Self included, so cards can say "3 wearers"
  const people = !feat.wearers ? [] : await db
    .select({
      id: schema.wearers.id,
      customerId: schema.wearers.customerId,
      name: schema.wearers.name,
      relation: schema.wearers.relation,
      school: schema.wearers.school,
      note: schema.wearers.note,
      isSelf: schema.wearers.isSelf,
    })
    .from(schema.wearers)
    .orderBy(desc(schema.wearers.isSelf), schema.wearers.id);
  const owner = can(session.role, "settings");
  const since = new Date(Date.now() - 30 * 86400_000);
  const [customers, lists, merged, sleeveNote, toCheck, wearerNote] = await Promise.all([
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
    // What the move to wearers did (one-time migration)
    owner
      ? db
          .select({ summary: schema.auditLog.summary })
          .from(schema.auditLog)
          .where(and(eq(schema.auditLog.entity, "measurement"), like(schema.auditLog.summary, "Wearers:%"), gte(schema.auditLog.at, since)))
          .orderBy(desc(schema.auditLog.at))
          .limit(1)
      : Promise.resolve([]),
  ]);
  // Unfinished simple-mode entries of the signed-in user — always at the top of the list
  const drafts = (!feat.simple ? [] : await db.select().from(schema.measurementDrafts).where(eq(schema.measurementDrafts.staffId, session.id)).orderBy(desc(schema.measurementDrafts.updatedAt))).map((d) => ({
    id: d.id,
    customerId: d.customerId,
    wearerId: d.wearerId,
    measurementId: d.measurementId,
    garmentType: d.garmentType,
    size: d.size,
    fit: d.fit,
    remarks: d.remarks,
    values: d.values,
    step: d.step,
    updatedAt: new Date(d.updatedAt).toISOString(),
  }));

  // Owner: live check of the move to wearers (read before going live)
  const wearerCheck = owner && feat.wearers
    ? (
        await db.execute(sql`select
          (select count(*) from ${schema.measurements})::int as total,
          (select count(*) from ${schema.measurements} m join ${schema.wearers} w on w.id = m.wearer_id where w.is_self)::int as on_self,
          (select count(*) from ${schema.measurements} m join ${schema.wearers} w on w.id = m.wearer_id where not w.is_self)::int as on_others,
          (select count(*) from ${schema.measurements} where wearer_id is null)::int as no_wearer,
          (select count(*) from ${schema.customers})::int as customers,
          (select count(*) from ${schema.customers} c where exists (select 1 from ${schema.wearers} w where w.customer_id = c.id and w.is_self))::int as with_self,
          (select count(*) from (select customer_id from ${schema.wearers} group by customer_id having count(*) > 1) x)::int as multi`)
      )
    : null;
  const wc = wearerCheck ? ((Array.isArray(wearerCheck) ? wearerCheck : (wearerCheck as { rows: unknown[] }).rows)[0] as Record<string, number>) : null;

  if (session.simple && view !== "detailed") {
    const settings = await getSettings();
    // Who was last given each person's garments (shown on the big cards)
    const tailors = await db
      .select({ wearerId: col.orderItemWearer, item: schema.orderItems.item, tailor: schema.staff.name, orderNo: schema.orders.orderNo })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .innerJoin(schema.staff, eq(schema.staff.id, schema.orderItems.tailorId))
      .where(and(sql`"order_items"."wearer_id" is not null`, ne(schema.orders.status, "Cancelled")))
      .orderBy(desc(schema.orders.id))
      .limit(1000);
    return (
      <>
        <h1 className="mx-auto mb-3 w-full max-w-xl font-ml text-3xl font-bold">
          അളവുകൾ <span className="font-sans text-base font-normal text-muted-foreground">Measurements</span>
        </h1>
        <SimpleMeasurements
          rows={rows.map((r) => ({ ...r.m, wearerId: r.wearerId, updatedAt: new Date(r.m.updatedAt).toISOString(), createdAt: undefined }))}
          customers={customers}
          wearers={people}
          drafts={drafts}
          tailors={tailors.map((t) => ({ ...t, wearerId: t.wearerId! }))}
          sizeChart={settings.sizeChart}
          order={settings.measureOrder}
          autoAdvance={settings.measureOptions?.autoAdvance ?? false}
          customerTypes={settings.lists.customerType}
        />
      </>
    );
  }

  return (
    <>
      {feat.simple && <SimpleSwitch simple={!!session.simple} />}
      <PageHeader title="Measurements" ml="അളവുകൾ" description="Saved once per customer and garment — reuse on every order." />
      {merged[0] && (
        <p className="mb-3 rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          Shirt now holds both sleeve lengths in one record — {merged[0].summary?.replace("Shirt merge: ", "")}.
        </p>
      )}
      {wearerNote[0] && <p className="mb-3 rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">{wearerNote[0].summary}.</p>}
      {wc && (
        <details className="mb-3 rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground" open={!!wearerNote[0]}>
          <summary className="cursor-pointer font-medium text-foreground">Wearer check (live)</summary>
          <ul className="mt-1 grid gap-0.5 tabular-nums">
            <li>
              Measurement records: {wc.total} — on a customer&apos;s Self: <b className="text-foreground">{wc.on_self}</b>, on another person: {wc.on_others}, with no wearer:{" "}
              <b className={wc.no_wearer ? "text-destructive" : "text-foreground"}>{wc.no_wearer}</b>
            </li>
            <li>
              Customers: {wc.customers} — with a Self wearer: {wc.with_self} — with more than one wearer: <b className="text-foreground">{wc.multi}</b>
            </li>
          </ul>
        </details>
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
        rows={rows.map((r) => ({ ...r.m, wearerId: r.wearerId, customerName: r.customerName, phone: r.phone }))}
        customers={customers}
        wearers={people}
        drafts={drafts}
        order={drafts.length ? (await getSettings()).measureOrder : {}}
        lists={{ customerType: lists.customerType, fit: lists.fit }}
      />
    </>
  );
}
