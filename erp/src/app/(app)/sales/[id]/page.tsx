import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSaleFull } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { SaleView } from "./sale-view";

export default async function SalePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const session = await requireUser();
  const sale = await getSaleFull(Number((await params).id));
  if (!sale) notFound();
  const shop = await getSetting("shop");
  const { print } = await searchParams;
  return <SaleView sale={sale} shop={shop} autoPrint={print === "1"} canCancel={session.role === "partner"} />;
}
