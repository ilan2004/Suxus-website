"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Ruler, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/app/empty";
import { MeasurementCard, type MeasurementRow } from "@/components/forms/measurement-dialog";
import { AddPersonForm } from "@/components/forms/wearer-picker";
import { deleteWearer } from "@/lib/actions/wearers";
import { wearerTitle, type WearerLite } from "@/lib/wearers";

/**
 * Customer page → Measurements: one block per person measured under this customer. With only "Self" it is the
 * plain list of garment cards it always was, plus an "Add another person" button.
 */
export function PeopleMeasurements({
  customerId,
  measurements,
  wearers,
  onMeasure,
}: {
  customerId: number;
  measurements: MeasurementRow[];
  wearers: WearerLite[];
  onMeasure: (m: Partial<MeasurementRow>) => void;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<"new" | WearerLite | null>(null);
  const self = wearers.find((w) => w.isSelf);
  const multi = wearers.length > 1;
  const of = (w: WearerLite) => measurements.filter((m) => (m.wearerId ?? self?.id) === w.id);
  const cards = (list: MeasurementRow[]) => (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((m) => (
        <MeasurementCard key={m.id} m={m} onEdit={() => onMeasure(m)} />
      ))}
    </div>
  );
  const done = () => {
    setForm(null);
    router.refresh();
  };

  return (
    <div className="grid gap-4">
      {form && <AddPersonForm customerId={customerId} initial={form === "new" ? undefined : form} onCancel={() => setForm(null)} onAdded={done} />}
      {!multi ? (
        measurements.length ? (
          cards(measurements)
        ) : (
          <Empty icon={Ruler} title="No measurements yet">
            <Button className="mt-3" variant="outline" onClick={() => onMeasure({ customerId, wearerId: self?.id ?? null })}>
              <Plus /> Add measurements
            </Button>
          </Empty>
        )
      ) : (
        wearers
          .filter((w) => !w.isSelf || of(w).length)
          .map((w) => (
            <section key={w.id} className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{wearerTitle(w)}</h3>
                {w.note && <span className="text-xs text-muted-foreground italic">{w.note}</span>}
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onMeasure({ customerId, wearerId: w.id })}>
                    <Plus className="size-3.5" /> Add garment
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${w.name}`} onClick={() => setForm(w)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  {!w.isSelf && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${w.name}`}
                      onClick={async () => {
                        if (!confirm(`Remove ${w.name}?`)) return;
                        const r = await deleteWearer(w.id);
                        if (!r.ok) return void toast.error(r.error);
                        router.refresh();
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
              {of(w).length ? cards(of(w)) : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No measurements yet.</p>}
            </section>
          ))
      )}
      {form !== "new" && wearers.length > 0 && (
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setForm("new")}>
          <UserPlus /> Add another person <span className="ml">മറ്റൊരാളെ ചേർക്കുക</span>
        </Button>
      )}
    </div>
  );
}
