import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { incentiveFor } from "@/lib/reports";
import { PageHeader } from "@/components/app/page-header";
import { resolvePeriod } from "@/lib/utils";
import { PeriodPicker } from "@/components/app/period-picker";
import { IncentiveView } from "./incentive-view";

export const metadata = { title: "Incentive" };

export default async function IncentivePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireUser({ can: "staff" });
  const { from, to } = resolvePeriod(await searchParams);
  const db = await getDb();
  const [rows, settings, history] = await Promise.all([
    incentiveFor(from, to),
    getSettings(),
    db
      .select({ p: schema.incentivePayouts, name: schema.staff.name })
      .from(schema.incentivePayouts)
      .innerJoin(schema.staff, eq(schema.staff.id, schema.incentivePayouts.staffId))
      .orderBy(desc(schema.incentivePayouts.fromDate)),
  ]);
  return (
    <>
      <PageHeader
        title="Incentive"
        ml="ഇൻസെന്റീവ് കണക്ക്"
        description="Based on money actually collected in the period from orders a person brought / fabric they sold (collection, not booking)."
      />
      <div className="mb-4">
        <PeriodPicker from={from} to={to} presets={["month", "last"]} />
      </div>
      <IncentiveView
        from={from}
        to={to}
        rows={rows}
        slabs={settings.slabs}
        modes={settings.lists.paymentMode}
        history={history.map((h) => ({ ...h.p, name: h.name, createdAt: undefined, updatedAt: undefined }))}
      />
    </>
  );
}
