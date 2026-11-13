import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { customerOptions, fabricsWithStock, staffOptions } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { PosForm } from "./pos-form";

export const metadata = { title: "New fabric sale" };

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ customer?: string; order?: string }> }) {
  const session = await requireUser();
  const sp = await searchParams;
  const [fabrics, customers, staff, settings] = await Promise.all([fabricsWithStock(), customerOptions(), staffOptions(), getSettings()]);
  return (
    <>
      <PageHeader title="New fabric sale" ml="പുതിയ തുണി ബിൽ" description="Scan a barcode or type a fabric code, add metres, save & print." />
      <PosForm
        fabrics={fabrics
          .filter((f) => f.active)
          .map((f) => ({ id: f.id, code: f.code, barcode: f.barcode, brand: f.brand, shade: f.shade, type: f.type, saleRate: f.saleRate, balanceMtr: f.balanceMtr }))}
        customers={customers}
        staff={staff.map((s) => ({ id: s.id, name: s.name }))}
        paymentModes={settings.lists.paymentMode}
        customerTypes={settings.lists.customerType}
        currentUserId={session.id}
        initialCustomerId={sp.customer ? Number(sp.customer) : null}
        orderId={sp.order ? Number(sp.order) : null}
      />
    </>
  );
}
