import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { OrderForm } from "@/components/forms/order-form";
import { loadOrderFormData } from "../order-data";

export const metadata = { title: "New stitching order" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ sale?: string; customer?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const data = await loadOrderFormData(sp.sale ? Number(sp.sale) : null);
  return (
    <>
      <PageHeader title="New stitching order" ml="പുതിയ തയ്യൽ / ആൾട്ടറേഷൻ ഓർഡർ" />
      <OrderForm {...data} initial={sp.customer ? { customerId: Number(sp.customer) } : undefined} />
    </>
  );
}
