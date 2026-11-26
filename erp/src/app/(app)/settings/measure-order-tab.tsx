"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateSetting } from "@/lib/actions/settings";
import { GARMENT_TYPES, measuringOrder } from "@/lib/measurements";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

/**
 * Settings → Measuring order: the order the tape goes, per garment, set once by dragging. Simple measurement mode
 * asks the fields in this order (the detailed form and the stored data are unchanged).
 */
export function MeasureOrderTab({ value, options }: { value: Record<string, string[]>; options: { autoAdvance: boolean } }) {
  const router = useRouter();
  const [garment, setGarment] = React.useState(GARMENT_TYPES[0]);
  const [all, setAll] = React.useState(value);
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [pending, start] = React.useTransition();
  const fields = measuringOrder(garment, all);
  const dirty = JSON.stringify(all) !== JSON.stringify(value);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= fields.length || from === to) return;
    const keys = fields.map((f) => f.key);
    const [k] = keys.splice(from, 1);
    keys.splice(to, 0, k);
    setAll((a) => ({ ...a, [garment]: keys }));
  };

  return (
    <div className="grid max-w-xl gap-4 rounded-xl border bg-card p-5">
      <div>
        <p className="font-medium">
          Measuring order <span className="ml">അളക്കുന്ന ക്രമം</span>
        </p>
        <p className="text-sm text-muted-foreground">Drag the fields into the order the tape goes. Simple measurement mode asks them in this order, for everyone.</p>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
        <Switch
          checked={options.autoAdvance}
          aria-label="Move to the next field by itself"
          onCheckedChange={(on) =>
            start(async () => {
              const r = await updateSetting("measureOptions", { ...options, autoAdvance: on });
              if (!r.ok) return void toast.error(r.error);
              toast.success(on ? "Auto-advance on" : "Auto-advance off — only Next moves forward");
              router.refresh();
            })
          }
        />
        <span className="text-sm">
          <span className="block font-medium">Move to the next field by itself after a pause</span>
          <span className="block text-muted-foreground">Off: the screen moves forward only when Next is tapped (safer — a pause to read the tape never records a half-typed number).</span>
        </span>
      </label>
      <select value={garment} onChange={(e) => setGarment(e.target.value)} aria-label="Garment" className="h-10 rounded-md border border-input bg-card px-2 text-sm font-medium">
        {GARMENT_TYPES.map((g) => (
          <option key={g}>{g}</option>
        ))}
      </select>
      <ol className="grid gap-1.5">
        {fields.map((f, i) => (
          <li
            key={f.key}
            draggable
            onDragStart={() => setDragging(i)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragging != null && dragging !== i) {
                move(dragging, i);
                setDragging(i);
              }
            }}
            onDragEnd={() => setDragging(null)}
            className={cn("flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5", dragging === i && "border-primary bg-primary/5")}
          >
            <GripVertical className="size-4 cursor-grab text-muted-foreground" />
            <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">{i + 1}.</span>
            <span className="flex-1 text-sm">
              {f.part ? f.key : f.en} <span className="ml">{f.ml}</span>
            </span>
            {/* Buttons too, for a phone (no dragging there) */}
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${f.key} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${f.key} down`} disabled={i === fields.length - 1} onClick={() => move(i, i + 1)}>
              <ArrowDown />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setAll((a) => Object.fromEntries(Object.entries(a).filter(([g]) => g !== garment)))}>
          <RotateCcw /> Stored order for {garment}
        </Button>
        <Button
          type="button"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const r = await updateSetting("measureOrder", all);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Measuring order saved");
              router.refresh();
            })
          }
        >
          {pending && <Loader2 className="animate-spin" />} Save order
        </Button>
      </div>
    </div>
  );
}
