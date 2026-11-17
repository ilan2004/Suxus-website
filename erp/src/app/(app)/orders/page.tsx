import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ordersWithBalance } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { OrdersView } from "./orders-view";

export const metadata = { title: "Stitching Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; filter?: string }> }) {
  await requireUser();
  const [rows, sp] = await Promise.all([ordersWithBalance(), searchParams]);
  if (sp.view === "board") redirect("/orders/board");
  return (
    <>
      <PageHeader
        title="Stitching Orders"
        ml="തയ്യൽ / ആൾട്ടറേഷൻ ഓർഡർ"
        actions={
          <Button asChild size="lg" variant="gold">
            <Link href="/orders/new">
              <Plus /> New order
            </Link>
          </Button>
        }
      />
      <OrdersView rows={rows} initialFilter={sp.filter ?? "all"} />
    </>
  );
}
