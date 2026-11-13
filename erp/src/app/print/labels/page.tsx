import { inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { AutoPrint } from "@/components/print/auto-print";
import { Barcode } from "./barcode";

export const metadata = { title: "Fabric labels" };

/** 50 × 25 mm barcode labels — one per selected fabric. */
export default async function Labels({ searchParams }: { searchParams: Promise<{ ids?: string; copies?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const ids = (sp.ids ?? "").split(",").map(Number).filter(Boolean);
  const copies = Math.min(50, Math.max(1, Number(sp.copies) || 1));
  const db = await getDb();
  const fabrics = ids.length ? await db.select().from(schema.fabrics).where(inArray(schema.fabrics.id, ids)) : [];
  const shop = await getSetting("shop");
  const labels = fabrics.flatMap((f) => Array.from({ length: copies }, () => f));
  return (
    <>
      <AutoPrint auto={false} paper="label" />
      <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3 py-6 print:block print:max-w-none print:p-0">
        {labels.map((f, i) => (
          <div
            key={i}
            className="flex h-[25mm] w-[50mm] flex-col items-center justify-center overflow-hidden bg-white px-[2mm] text-center leading-tight text-black shadow print:break-after-page print:shadow-none"
          >
            <div className="text-[7pt] font-bold tracking-[0.2em]">{shop.name}</div>
            <div className="w-full truncate text-[7.5pt]">
              {f.brand} {f.shade && `· ${f.shade}`}
            </div>
            <Barcode value={f.barcode || f.code} />
            <div className="flex w-full justify-between text-[8pt] font-bold">
              <span>{f.code}</span>
              <span>₹{f.saleRate}/m</span>
            </div>
          </div>
        ))}
        {!labels.length && <p className="text-sm">No fabrics selected.</p>}
      </div>
    </>
  );
}
