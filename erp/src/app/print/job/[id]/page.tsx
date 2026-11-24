import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getOrderFull } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { AutoPrint } from "@/components/print/auto-print";
import { fieldsFor, measureText } from "@/lib/measurements";
import { formatPhone } from "@/lib/phone";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Job slip" };

/**
 * 80 mm job slip for the cutting table / tailor: what to stitch, by when, and the customer's latest measurements
 * per garment. No prices. Shirt chest and waist print as recorded with the full figure beside it, e.g. "11.5 (shirt round 48)".
 */
export default async function JobSlip({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  await requireUser();
  const order = await getOrderFull(Number((await params).id));
  if (!order) notFound();
  const [shop, { auto }] = await Promise.all([getSetting("shop"), searchParams]);
  const db = await getDb();
  const all = order.customerId
    ? await db.select().from(schema.measurements).where(eq(schema.measurements.customerId, order.customerId)).orderBy(desc(schema.measurements.date), desc(schema.measurements.id))
    : [];
  const selfId = order.customerId
    ? ((await db.select({ id: schema.wearers.id }).from(schema.wearers).where(and(eq(schema.wearers.customerId, order.customerId), eq(schema.wearers.isSelf, true))))[0]?.id ?? null)
    : null;
  /** Latest record per garment for one person (records from before wearers count as Self). */
  const latestFor = (wearerId: number | null) => {
    const mine = all.filter((m) => (m.wearerId ?? selfId) === (wearerId ?? selfId));
    return mine.filter((m, i) => mine.findIndex((x) => x.garmentType === m.garmentType) === i);
  };
  // One block per person in the order, in the order their items were entered
  const groups: { key: string; wearerId: number | null; name: string; detail: string; items: typeof order.items }[] = [];
  for (const i of order.items) {
    const key = String(i.wearerId ?? "self");
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const w = i.wearer;
      g = {
        key,
        wearerId: i.wearerId ?? null,
        name: i.wearerName ?? order.customerName ?? "—",
        detail: w ? (w.isSelf ? "Self" : [w.relation !== "Other" ? w.relation : null, w.school].filter(Boolean).join(" · ")) : "",
        items: [],
      };
      groups.push(g);
    }
    g.items.push(i);
  }
  const multi = order.showWearers;
  const latest = latestFor(groups[0]?.wearerId ?? null);
  const measured = multi ? groups.flatMap((g) => latestFor(g.wearerId)) : latest;
  const hr = <div className="my-1.5 border-t border-dashed border-black" />;
  return (
    <>
      <AutoPrint auto={auto !== "0"} />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-fit shadow-lg print:shadow-none">
          <div className="mx-auto w-[72mm] bg-white p-[2mm] font-mono text-[11.5px] leading-[1.35] text-black">
            <div className="text-center">
              <div className="text-[13px] font-bold tracking-[0.25em]">{shop.name}</div>
              <div className="text-[12px] font-bold">JOB SLIP · ജോബ് സ്ലിപ്പ്</div>
            </div>
            {hr}
            <div className="flex justify-between text-[13px] font-bold">
              <span>{order.orderNo}</span>
              {order.urgency === "Express" && <span>EXPRESS</span>}
            </div>
            <div className="flex justify-between">
              <span>Booked {fmtDate(order.date)}</span>
              {order.trialDate && <span>Trial {fmtDate(order.trialDate)}</span>}
            </div>
            <div className="text-[13px] font-bold">Delivery: {order.deliveryDate ? fmtDate(order.deliveryDate) : "—"}</div>
            <div>Customer: {order.customerName ?? "—"}</div>
            {order.phone && <div>Phone: {formatPhone(order.phone)}</div>}
            {hr}
            {multi ? (
              <>
                <div className="text-center text-[12px] font-bold">
                  {groups.length} PEOPLE · {groups.length} ആളുകൾ
                </div>
                <div className="text-center text-[10px]">Each block is one person — sew by the NAME</div>
                {groups.map((g, n) => (
                  <div key={g.key} className="mt-2.5 border-[3px] border-black">
                    {/* The tailor must see at once whose garment this is */}
                    {/* Black text inside a heavy border — prints even when the browser drops background colours */}
                    <div className="border-b-[3px] border-black px-1.5 py-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[18px] leading-tight font-black tracking-wide uppercase">{g.name}</span>
                        <span className="shrink-0 text-[11px] font-bold">
                          {n + 1}/{groups.length}
                        </span>
                      </div>
                      {g.detail && <div className="text-[11px]">{g.detail}</div>}
                    </div>
                    <div className="px-1.5 py-1">
                      {g.items.map((i) => (
                        <div key={i.id} className="flex justify-between gap-2 text-[12.5px]">
                          <span className="font-bold">
                            {i.qty} × {i.item} <span className="font-normal">— {g.name}</span>
                          </span>
                          <span className={i.tailor ? "font-bold" : ""}>{i.tailor ?? "Not assigned"}</span>
                        </div>
                      ))}
                      <Measurements list={latestFor(g.wearerId)} owner={g.name} />
                    </div>
                  </div>
                ))}
                {order.remarks && <div className="mt-1 whitespace-pre-line">Note: {order.remarks}</div>}
              </>
            ) : (
              <>
                <div className="font-bold">Items · Tailor</div>
                {order.items.map((i) => (
                  <div key={i.id} className="flex justify-between gap-2">
                    <span>
                      {i.qty} × {i.item}
                    </span>
                    <span className={i.tailor ? "font-bold" : ""}>{i.tailor ?? "Not assigned"}</span>
                  </div>
                ))}
                {order.remarks && <div className="mt-1 whitespace-pre-line">Note: {order.remarks}</div>}
                {hr}
                <Measurements list={latest} />
              </>
            )}
            {hr}
            {measured.some((m) => fieldsFor(m.garmentType, m.values).some((f) => f.part && m.values[f.key] != null)) && (
              <div className="text-center text-[10px]">¼ = centre front to side on the folded garment · shirt round = × 4 + 2 (back panel 2″ wider)</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

type M = { id: number; garmentType: string; date: string; size: string | null; fit: string | null; values: Record<string, number | null>; remarks: string | null };

/** Latest measurements per garment; `owner` repeats the person's name on each garment heading. */
function Measurements({ list, owner }: { list: M[]; owner?: string }) {
  return (
    <>
      <div className={owner ? "mt-1 border-t border-dashed border-black pt-1 font-bold" : "font-bold"}>Measurements (inches)</div>
      {list.length === 0 && <div>No measurements saved{owner ? ` for ${owner}` : ""}.</div>}
      {list.map((m) => {
        const fields = fieldsFor(m.garmentType, m.values).filter((f) => m.values[f.key] != null);
        return (
          <div key={m.id} className="mt-1.5">
            <div className="font-bold">
              {m.garmentType}
              {owner && <> — {owner}</>}
              <span className="font-normal">
                {" "}
                · {fmtDate(m.date)}
                {m.size ? ` · Size ${m.size}` : ""}
                {m.fit ? ` · ${m.fit}` : ""}
              </span>
            </div>
            {fields.map((f) => (
              <div key={f.key} className="flex justify-between gap-2">
                <span className="shrink-0">{f.part ? `${f.key} ¼` : f.en}</span>
                <span className="text-right font-bold">{measureText(f, m.values[f.key])}</span>
              </div>
            ))}
            {m.remarks && <div className="italic">{m.remarks}</div>}
          </div>
        );
      })}
    </>
  );
}
