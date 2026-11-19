import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { SettingsView } from "./settings-view";
import { listTemplates } from "@/lib/actions/messages";
import { listUsers } from "@/lib/actions/users";
import { can } from "@/lib/permissions";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireUser({ can: "settings" });
  const [settings, templates, { tab }, users] = await Promise.all([getSettings(), listTemplates(), searchParams, can(me.role, "users") ? listUsers() : Promise.resolve(null)]);
  return (
    <>
      <PageHeader title="Settings" ml="സെറ്റിംഗ്സ്" description="Shop details on bills, dropdown lists, piece rates and fabric codes. Changes apply everywhere." />
      <SettingsView settings={settings} templates={templates} tab={tab} users={users} meId={me.id} />
    </>
  );
}
