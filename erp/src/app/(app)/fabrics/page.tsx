import { asc } from "drizzle-orm";
import { can } from "@/lib/permissions";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fabricsWithStock } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { FabricsView } from "./fabrics-view";
import { rupees, num } from "@/lib/utils";
import { storageMode } from "@/lib/storage";
import { AlertTriangle, Layers, Ruler, Wallet } from "lucide-react";

export const metadata = { title: "Fabric Stock" };

export default async function FabricsPage() {
  const session = await requireUser();
  const db = await getDb();
  const [fabrics, settings, suppliers] = await Promise.all([
    fabricsWithStock(),
    getSettings(),
    db.select({ id: schema.suppliers.id, name: schema.suppliers.name }).from(schema.suppliers).orderBy(asc(schema.suppliers.name)),
  ]);
  const active = fabrics.filter((f) => f.active);
  const low = active.filter((f) => f.balanceMtr <= settings.shop.lowStockMtr);
  return (
    <>
      <PageHeader title="Fabric Stock" ml="തുണി സ്റ്റോക്ക് (മീറ്റർ)" description="Sold and balance metres update automatically from every bill." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Fabrics" ml="ഇനങ്ങൾ" value={active.length} icon={Layers} />
        <StatCard label="Balance metres" ml="ബാക്കി മീറ്റർ" value={num(active.reduce((s, f) => s + f.balanceMtr, 0))} icon={Ruler} />
        {can(session.role, "costs") && (
          <StatCard label="Stock value (cost)" ml="സ്റ്റോക്ക് മൂല്യം" value={rupees(active.reduce((s, f) => s + f.stockValue, 0))} icon={Wallet} tone="gold" />
        )}
        <StatCard label="Low stock" ml="കുറവ്" value={low.length} sub={`≤ ${settings.shop.lowStockMtr} m left`} icon={AlertTriangle} tone={low.length ? "warning" : "success"} />
      </div>
      <FabricsView
        rows={fabrics}
        suppliers={suppliers}
        lists={{ fabricType: settings.lists.fabricType, colourFamily: settings.lists.colourFamily, partner: settings.lists.partner }}
        compositions={settings.compositions}
        lowStock={settings.shop.lowStockMtr}
        showCost={can(session.role, "costs")}
        photosEnabled={storageMode() !== "off"}
      />
    </>
  );
}
