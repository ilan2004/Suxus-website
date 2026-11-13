import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { salesList } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { SalesTable } from "./sales-table";

export const metadata = { title: "Fabric Sales" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireUser();
  const rows = await salesList();
  const { range } = await searchParams;
  return (
    <>
      <PageHeader
        title="Fabric Sales"
        ml="ദിവസേനയുള്ള തുണി വിൽപ്പന"
        actions={
          <Button asChild size="lg">
            <Link href="/sales/new">
              <Plus /> New sale
            </Link>
          </Button>
        }
      />
      <SalesTable rows={rows} initialRange={range === "today" || range === "all" ? range : "month"} />
    </>
  );
}
