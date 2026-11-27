import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { features } from "@/lib/db/features";
import { tryonEnquiries } from "@/lib/tryon-admin";
import { PageHeader } from "@/components/app/page-header";
import { EnquiriesView } from "./enquiries-view";

export const metadata = { title: "Try-on enquiries" };

/** Customers who tapped "I want this" on a try-on. Partners only. */
export default async function TryonEnquiriesPage() {
  await requireUser({ can: "prices" });
  const rows = (await features()).tryonLeads ? await tryonEnquiries() : [];
  return (
    <>
      <PageHeader
        title="Try-on enquiries"
        ml="ട്രൈ-ഓൺ അന്വേഷണങ്ങൾ"
        description={`Customers who tapped "I want this" on a try-on. ${rows.filter((r) => !r.contacted).length} not contacted yet.`}
        actions={
          <Link href="/settings/tryon" className="inline-flex h-9 items-center rounded-md border bg-card px-3 text-sm font-medium hover:bg-accent">
            Try-on QR & usage
          </Link>
        }
      />
      <EnquiriesView rows={rows} />
    </>
  );
}
