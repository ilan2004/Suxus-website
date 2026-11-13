import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { StaffView } from "./staff-view";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  await requireUser({ partner: true });
  const db = await getDb();
  const rows = await db.select().from(schema.staff).orderBy(asc(schema.staff.code));
  const lists = await getSetting("lists");
  return (
    <>
      <PageHeader title="Staff" ml="ജീവനക്കാർ" description="Names here appear in Sold By, Tailor and Brought By. Give a PIN to let someone sign in." />
      <StaffView
        rows={rows.map(({ pinHash, ...r }) => ({ ...r, hasPin: !!pinHash, ownIncentivePct: r.ownIncentivePct ? r.ownIncentivePct * 100 : null }))}
        lists={{ staffRole: lists.staffRole, payType: lists.payType }}
      />
    </>
  );
}
