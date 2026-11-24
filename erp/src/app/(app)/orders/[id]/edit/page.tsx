import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrderFull } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { OrderForm } from "@/components/forms/order-form";
import { loadOrderFormData } from "../../order-data";

export const metadata = { title: "Edit order" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const order = await getOrderFull(Number((await params).id));
  if (!order) notFound();
  const data = await loadOrderFormData(order.saleId);
  return (
    <>
      <PageHeader title={`Edit ${order.orderNo}`} ml="ഓർഡർ മാറ്റുക" />
      <OrderForm
        {...data}
        initial={{
          id: order.id,
          orderNo: order.orderNo,
          date: order.date,
          customerId: order.customerId,
          customerName: order.customerName,
          phone: order.phone,
          workType: order.workType,
          urgency: order.urgency,
          trialDate: order.trialDate,
          deliveryDate: order.deliveryDate,
          status: order.status,
          broughtById: order.broughtById,
          discount: order.discount,
          remarks: order.remarks,
          items: order.items.map((i) => ({ item: i.item, qty: i.qty, rate: i.rate, tailorId: i.tailorId })),
        }}
      />
    </>
  );
}
