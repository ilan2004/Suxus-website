import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { bulkList } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { BulkTable } from "./bulk-table";
import { rupees } from "@/lib/utils";
import { Building2, CircleDollarSign, Shirt } from "lucide-react";

export const metadata = { title: "Bulk Orders" };

export default async function BulkPage() {
  await requireUser();
  const rows = await bulkList();
  const open = rows.filter((r) => !["Delivered", "Cancelled"].includes(r.status));
  return (
    <>
      <PageHeader
        title="Bulk / Institution Orders"
        ml="സ്കൂൾ & സ്ഥാപന ഓർഡർ"
        description="Schools, colleges, hospitals and companies — one line per size, A4 GST invoice."
        actions={
          <Button asChild size="lg" variant="gold">
            <Link href="/bulk/new">
              <Plus /> New bulk order
            </Link>
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Open orders" ml="നടക്കുന്നത്" value={open.length} icon={Building2} tone="gold" />
        <StatCard label="Pieces in work" ml="പീസ്" value={open.reduce((s, r) => s + r.pieces, 0)} icon={Shirt} />
        <StatCard label="Balance to collect" ml="കിട്ടാനുള്ളത്" value={rupees(rows.filter((r) => r.status !== "Cancelled").reduce((s, r) => s + Math.max(0, r.balance), 0))} icon={CircleDollarSign} tone="warning" />
      </div>
      <BulkTable rows={rows} />
    </>
  );
}
