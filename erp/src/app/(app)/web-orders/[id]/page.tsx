import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { features } from "@/lib/db/features";
import { webOrder } from "@/lib/web-orders";
import { formatPhone, waMeLink } from "@/lib/phone";
import { FIGURE_LABEL, erpMeasurement, type Unit } from "@/lib/web-order";
import { GARMENTS, measureText } from "@/lib/measurements";
import { PageHeader } from "@/components/app/page-header";
import { WebOrderActions } from "./actions";

export const metadata = { title: "Website order" };

/** One website order: contact, courier address, each garment with the customer's figures and the ERP values. */
export default async function WebOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  if (!(await features()).webOrders) notFound();
  const o = await webOrder(Number((await params).id));
  if (!o) notFound();
  const unit = o.unit as Unit;
  const wa = waMeLink(o.phone, `SUXUS Heritage Tailor — നിങ്ങളുടെ വെബ്സൈറ്റ് ഓർഡർ #${o.id} കിട്ടി. Thank you for your order #${o.id}.`);
  return (
    <>
      <PageHeader
        title={`Website order #${o.id}`}
        ml="വെബ്സൈറ്റ് ഓർഡർ"
        description={new Date(o.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
        actions={
          <Link href="/web-orders" className="inline-flex h-9 items-center rounded-md border bg-card px-3 text-sm font-medium hover:bg-accent">
            All website orders
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        <section className="grid content-start gap-3 rounded-xl border bg-card p-4 text-sm" data-testid="web-order-contact">
          <p className="text-lg font-semibold">{o.name}</p>
          <p className="flex flex-wrap gap-x-3">
            <a href={`tel:${o.phone}`} className="tabular-nums underline">
              {formatPhone(o.phone)}
            </a>
            {wa && (
              <a href={wa} target="_blank" className="text-[#128C4B] underline">
                WhatsApp
              </a>
            )}
          </p>
          <div>
            <p className="text-xs text-muted-foreground">Courier address</p>
            <p className="whitespace-pre-line">{o.address}</p>
            <p>PIN {o.pincode}</p>
          </div>
          {o.note && (
            <div>
              <p className="text-xs text-muted-foreground">Note from the customer</p>
              <p className="whitespace-pre-line">{o.note}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Typed in {unit === "cm" ? "centimetres" : "inches"} — ERP values below are in inches.</p>
          <WebOrderActions id={o.id} status={o.status} customer={o.customer} handled={o.handledBy ? `${o.handledBy}${o.handledAt ? `, ${new Date(o.handledAt).toLocaleDateString("en-IN")}` : ""}` : null} />
        </section>
        <section className="grid content-start gap-3">
          {o.items.map((it, i) => {
            const f = o.fabrics[it.fabricCode];
            const m = erpMeasurement(it, unit);
            const fields = GARMENTS[m.garmentType] ?? [];
            return (
              <article key={i} className="grid gap-3 rounded-xl border bg-card p-4" data-testid="web-order-item">
                <div className="flex items-center gap-3">
                  {f?.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.thumb} alt="" className="size-14 rounded-lg border object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {it.qty > 1 ? `${it.qty} × ` : ""}
                      {it.garment === "Shirt" ? `Shirt — ${it.sleeve === "full" ? "full" : "half"} sleeve · pocket: ${it.pocket === "two" ? "two, flap + button" : it.pocket === "one" ? "one (left)" : "none"}` : `Pant — ${it.model}`}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {it.fabricCode} {f ? `· ${f.name} · ₹${f.rate}/m` : "· (fabric not found)"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Customer&apos;s figures ({unit})</p>
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(it.m).map(([k, v]) => (
                          <tr key={k} className="border-t">
                            <td className="py-1 pr-2">{FIGURE_LABEL[k as keyof typeof FIGURE_LABEL] ?? k}</td>
                            <td className="py-1 text-right tabular-nums">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">ERP {m.garmentType} measurement (inches)</p>
                    <table className="w-full text-sm" data-testid="erp-values">
                      <tbody>
                        {fields
                          .filter((fl) => m.values[fl.key] != null)
                          .map((fl) => (
                            <tr key={fl.key} className="border-t">
                              <td className="py-1 pr-2">
                                {fl.part ? fl.key : fl.en} <span className="ml text-muted-foreground">{fl.ml}</span>
                              </td>
                              <td className="py-1 text-right tabular-nums">{measureText(fl, m.values[fl.key])}</td>
                            </tr>
                          ))}
                        {m.fit && (
                          <tr className="border-t">
                            <td className="py-1 pr-2">Fit</td>
                            <td className="py-1 text-right">{m.fit}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <p className="mt-1 text-xs text-muted-foreground">{m.remarks}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </>
  );
}
