import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBulkFull } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { BulkForm } from "@/components/forms/bulk-form";
import { loadBulkFormData } from "../../form-data";

export const metadata = { title: "Edit bulk order" };

export default async function EditBulkPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const o = await getBulkFull(Number((await params).id));
  if (!o) notFound();
  return (
    <>
      <PageHeader title={`Edit ${o.orderNo}`} ml="ഓർഡർ മാറ്റുക" />
      <BulkForm
        {...await loadBulkFormData()}
        initial={{
          id: o.id,
          orderNo: o.orderNo,
          date: o.date,
          institution: o.institution,
          address: o.address,
          contactPerson: o.contactPerson,
          phone: o.phone,
          gstin: o.gstin,
          fabricBy: o.fabricBy,
          deliveryDate: o.deliveryDate,
          status: o.status,
          broughtById: o.broughtById,
          discount: o.discount,
          gstPct: o.gstPct,
          remarks: o.remarks,
          items: o.items,
        }}
      />
    </>
  );
}
