import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { customerOptions } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { MeasurementsView } from "./measurements-view";

export const metadata = { title: "Measurements" };

export default async function MeasurementsPage() {
  await requireUser();
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
  const [customers, lists] = await Promise.all([customerOptions(), getSetting("lists")]);
  return (
    <>
      <PageHeader title="Measurements" ml="അളവുകൾ" description="Saved once per customer and garment — reuse on every order." />
      <MeasurementsView
        rows={rows.map((r) => ({ ...r.m, customerName: r.customerName, phone: r.phone }))}
        customers={customers}
        lists={{ customerType: lists.customerType, fit: lists.fit }}
      />
    </>
  );
}
