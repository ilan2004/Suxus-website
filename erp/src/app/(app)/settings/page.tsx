import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireUser({ partner: true });
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" ml="സെറ്റിംഗ്സ്" description="Shop details on bills, dropdown lists, piece rates and fabric codes. Changes apply everywhere." />
      <SettingsView settings={settings} />
    </>
  );
}
