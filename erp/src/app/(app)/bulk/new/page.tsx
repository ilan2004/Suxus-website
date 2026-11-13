import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { BulkForm } from "@/components/forms/bulk-form";
import { loadBulkFormData } from "../form-data";

export const metadata = { title: "New bulk order" };

export default async function NewBulkPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="New bulk / institution order" ml="സ്കൂൾ & സ്ഥാപന ഓർഡർ" />
      <BulkForm {...await loadBulkFormData()} />
    </>
  );
}
