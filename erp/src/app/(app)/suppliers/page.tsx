import { requireUser } from "@/lib/auth";
import { suppliersWithBalance } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { SuppliersView } from "./suppliers-view";
import { rupees } from "@/lib/utils";
import { CircleDollarSign, Truck } from "lucide-react";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  await requireUser();
  const rows = await suppliersWithBalance();
  const due = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);
  return (
    <>
      <PageHeader title="Suppliers" ml="സപ്ലയർമാരും പേയ്‌മെന്റ് വിവരങ്ങളും" description="Phone, UPI and bank details, what you bought, what you paid and what is still due." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Suppliers" ml="സപ്ലയർ" value={rows.length} icon={Truck} />
        <StatCard label="Balance to pay" ml="കൊടുക്കാനുള്ളത്" value={rupees(due)} icon={CircleDollarSign} tone={due > 0 ? "destructive" : "success"} />
      </div>
      <SuppliersView rows={rows} />
    </>
  );
}
