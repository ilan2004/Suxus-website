import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
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
  const session = await requireUser();
  const money = can(session.role, "money");
  const [{ rows: due, total, all }, lists] = await Promise.all([supplierDues(), getSetting("lists")]);
  // Without "money" the balances never leave the server
  const rows = money ? all : all.map((r) => ({ ...r, billed: 0, paidAtBill: 0, paidLater: 0, setupPaid: 0, setupCredit: 0, openingBalance: 0, owed: 0, paid: 0, balance: 0, lastPaid: null, lastMode: null, notes: null }));
  const payers = ["Business Account", ...lists.partner.filter((p) => p !== "Business Account")];
  return (
    <>
      <PageHeader title="Suppliers" ml="സപ്ലയർമാരും പേയ്‌മെന്റ് വിവരങ്ങളും" description={money ? "Phone, UPI and bank details, what you bought, what you paid and what is still due." : "Phone, UPI and bank details and what was bought."} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Suppliers" ml="സപ്ലയർ" value={rows.length} icon={Truck} />
        {money && <BalanceToPayCard rows={due} total={total} today={today()} payers={payers} />}
      </div>
      <SuppliersView rows={rows} showMoney={money} />
    </>
  );
}
