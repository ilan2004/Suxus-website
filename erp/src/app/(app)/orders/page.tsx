import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ordersWithBalance } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { OrdersView } from "./orders-view";

export const metadata = { title: "Stitching Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; filter?: string }> }) {
  await requireUser();
  const [rows, lists, sp] = await Promise.all([ordersWithBalance(), getSetting("lists"), searchParams]);
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
      <OrdersView rows={rows} statuses={lists.status} initialView={sp.view === "list" ? "list" : "board"} initialFilter={sp.filter ?? "all"} />
    </>
  );
}
