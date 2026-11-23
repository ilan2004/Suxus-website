import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { SettingsView } from "./settings-view";
import { listTemplates } from "@/lib/actions/messages";
import { listUsers } from "@/lib/actions/users";
import { can } from "@/lib/permissions";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireUser({ can: "settings" });
  const db = await getDb();
  const [settings, templates, { tab }, users, photoLog] = await Promise.all([
    getSettings(),
    listTemplates(),
    searchParams,
    can(me.role, "users") ? listUsers() : Promise.resolve(null),
    // Settings → Fabric photos: the last analysed photos (scale card, repeat, mm, colours)
    db
      .select({ l: schema.fabricPhotoLog, code: schema.fabrics.code, brand: schema.fabrics.brand, pattern: schema.fabrics.pattern })
      .from(schema.fabricPhotoLog)
      .leftJoin(schema.fabrics, eq(schema.fabrics.id, schema.fabricPhotoLog.fabricId))
      .orderBy(desc(schema.fabricPhotoLog.id))
      .limit(100),
  ]);
  return (
    <>
      <PageHeader title="Settings" ml="സെറ്റിംഗ്സ്" description="Shop details on bills, dropdown lists, piece rates and fabric codes. Changes apply everywhere." />
      <SettingsView
        settings={settings}
        templates={templates}
        tab={tab}
        users={users}
        meId={me.id}
        photoLog={photoLog.map(({ l, code, brand, pattern }) => ({ ...l, at: new Date(l.createdAt).toISOString(), code, brand, pattern }))}
      />
    </>
  );
}
