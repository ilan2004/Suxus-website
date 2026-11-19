import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { SettingsView } from "./settings-view";
import { listTemplates } from "@/lib/actions/messages";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser({ can: "settings" });
  const [settings, templates, { tab }] = await Promise.all([getSettings(), listTemplates(), searchParams]);
  return (
    <>
      <PageHeader title="Settings" ml="സെറ്റിംഗ്സ്" description="Shop details on bills, dropdown lists, piece rates and fabric codes. Changes apply everywhere." />
      <SettingsView settings={settings} templates={templates} tab={tab} />
    </>
  );
}
