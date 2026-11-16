import { requireUser } from "@/lib/auth";
import { supplierDues } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { SuppliersView } from "./suppliers-view";
import { BalanceToPayCard } from "./balance-to-pay";
import { today } from "@/lib/utils";
import { Truck } from "lucide-react";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  await requireUser();
  const [{ rows: due, total, all: rows }, lists] = await Promise.all([supplierDues(), getSetting("lists")]);
  const payers = ["Business Account", ...lists.partner.filter((p) => p !== "Business Account")];
  return (
    <>
      <PageHeader title="Suppliers" ml="സപ്ലയർമാരും പേയ്‌മെന്റ് വിവരങ്ങളും" description="Phone, UPI and bank details, what you bought, what you paid and what is still due." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Suppliers" ml="സപ്ലയർ" value={rows.length} icon={Truck} />
        <BalanceToPayCard rows={due} total={total} today={today()} payers={payers} />
      </div>
      <SuppliersView rows={rows} />
    </>
  );
}
