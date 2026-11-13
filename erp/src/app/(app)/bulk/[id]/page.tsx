import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBulkFull } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { BulkView } from "./bulk-view";

export default async function BulkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const o = await getBulkFull(Number((await params).id));
  if (!o) notFound();
  const s = await getSettings();
  return <BulkView order={o} statuses={s.lists.status} modes={s.lists.paymentMode} shopName={s.shop.name} isPartner={session.role === "partner"} />;
}
