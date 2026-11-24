import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { jobSlipToken } from "@/lib/job-slip";

/** The printed job slip is replaced by the job slip PDF (one garment per page): old links open the PDF. */
export default async function OldJobSlip({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const db = await getDb();
  const [o] = Number.isInteger(id) ? await db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.id, id)) : [];
  if (!o) notFound();
  redirect(`/j/${await jobSlipToken(o.id, null)}`);
}
