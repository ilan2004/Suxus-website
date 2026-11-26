"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateSetting } from "@/lib/actions/settings";
import {
  DEFAULT_FABRIC_REQUIREMENT,
  fabricRequirement,
  metres,
  type BandRow,
  type FabricRequirementTables,
  type PantRow,
} from "@/lib/fabric-requirement";

/**
 * Settings → Fabric requirement (തുണിയുടെ അളവ്): every figure and every band limit is editable. Each row has a fabric
 * width (58 by default), so rows for another width can be added later as their own set.
 */
export function FabricRequirementTab({ value }: { value: FabricRequirementTables }) {
  const router = useRouter();
  const [t, setT] = React.useState<FabricRequirementTables>(value);
  const [pending, start] = React.useTransition();
  const dirty = JSON.stringify(t) !== JSON.stringify(value);

  const save = () =>
    start(async () => {
      const r = await updateSetting("fabricRequirement", t);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Fabric requirement saved");
      router.refresh();
    });

  return (
    <div className="grid max-w-3xl gap-5">
      <div className="rounded-xl border bg-card p-5 text-sm">
        <p className="font-medium">
          Fabric requirement <span className="ml">തുണിയുടെ അളവ്</span>
        </p>
        <p className="text-muted-foreground">
          Metres per garment before cutting — an estimate shown on stitching orders and job slips. Stock is still reduced only by the bill. For a shirt both tables are looked up and the
          higher figure is used. Full or half sleeve, and Regular or Loose model, come from the order item&apos;s variant (തരം).
        </p>
      </div>

      <BandTable
        title="Shirt — Table A, by recorded chest"
        ml="ഷർട്ട് — നെഞ്ചളവ് (¼ അളവ്)"
        note="The recorded chest (centre front to side, the quarter) — not the shirt round."
        unit="Recorded chest"
        rows={t.shirtChest}
        onChange={(shirtChest) => setT((x) => ({ ...x, shirtChest }))}
      />
      <BandTable
        title="Shirt — Table B, by shirt length"
        ml="ഷർട്ട് — നീളം"
        unit="Shirt length"
        rows={t.shirtLength}
        onChange={(shirtLength) => setT((x) => ({ ...x, shirtLength }))}
      />
      <PantTable rows={t.pant} onChange={(pant) => setT((x) => ({ ...x, pant }))} />

      <TryIt tables={t} />

      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setT(DEFAULT_FABRIC_REQUIREMENT)}>
          <RotateCcw /> Back to the original figures
        </Button>
        <Button type="button" onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="animate-spin" />} Save
        </Button>
      </div>
    </div>
  );
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

function BandTable({ title, ml, note, unit, rows, onChange }: { title: string; ml: string; note?: string; unit: string; rows: BandRow[]; onChange: (r: BandRow[]) => void }) {
  const set = (i: number, patch: Partial<BandRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  // "from" of each row = the previous limit of the same width, in the order shown
  const fromOf = (i: number) => {
    const prev = rows.slice(0, i).filter((r) => r.width === rows[i].width && r.upTo != null).at(-1);
    return prev ? `above ${prev.upTo}` : "";
  };
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <p className="font-medium">
          {title} <span className="ml">{ml}</span>
        </p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="p-2">Fabric width (in)</th>
              <th className="p-2">{unit} — from</th>
              <th className="p-2">up to (in)</th>
              <th className="p-2">Full sleeve (m)</th>
              <th className="p-2">Half sleeve (m)</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-2">
                  <Input aria-label="Fabric width" type="number" inputMode="decimal" className="w-20" value={r.width} onChange={(e) => set(i, { width: Number(e.target.value) || 58 })} />
                </td>
                <td className="p-2 text-xs whitespace-nowrap text-muted-foreground">{fromOf(i) || "from 0"}</td>
                <td className="p-2">
                  <Input
                    aria-label={`${unit} up to`}
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    className="w-24"
                    placeholder="and above"
                    value={r.upTo ?? ""}
                    onChange={(e) => set(i, { upTo: num(e.target.value) })}
                  />
                </td>
                <td className="p-2">
                  <Input aria-label="Full sleeve metres" type="number" inputMode="decimal" step="0.05" className="w-24" value={r.full} onChange={(e) => set(i, { full: Number(e.target.value) })} />
                </td>
                <td className="p-2">
                  <Input aria-label="Half sleeve metres" type="number" inputMode="decimal" step="0.05" className="w-24" value={r.half} onChange={(e) => set(i, { half: Number(e.target.value) })} />
                </td>
                <td className="p-2">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove row" disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, k) => k !== i))}>
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t px-4 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, { width: rows.at(-1)?.width ?? 58, upTo: null, full: rows.at(-1)?.full ?? 1.5, half: rows.at(-1)?.half ?? 1.3 }])}>
          <Plus /> Add row
        </Button>
        <span className="text-xs text-muted-foreground">Leave "up to" empty on the last row for "and above". Rows are checked from the smallest limit.</span>
      </div>
    </section>
  );
}

function PantTable({ rows, onChange }: { rows: PantRow[]; onChange: (r: PantRow[]) => void }) {
  const set = (i: number, patch: Partial<PantRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <p className="font-medium">
          Pant / Trouser <span className="ml">പാന്റ്</span>
        </p>
        <p className="text-xs text-muted-foreground">The order item&apos;s variant (തരം): Regular or Loose model.</p>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="p-2">Fabric width (in)</th>
            <th className="p-2">Model</th>
            <th className="p-2">Metres</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="p-2">
                <Input aria-label="Fabric width" type="number" inputMode="decimal" className="w-20" value={r.width} onChange={(e) => set(i, { width: Number(e.target.value) || 58 })} />
              </td>
              <td className="p-2">
                <select aria-label="Model" value={r.model} onChange={(e) => set(i, { model: e.target.value as PantRow["model"] })} className="h-9 rounded-md border border-input bg-card px-2">
                  <option value="Regular">Regular</option>
                  <option value="Loose">Loose model</option>
                </select>
              </td>
              <td className="p-2">
                <Input aria-label="Pant metres" type="number" inputMode="decimal" step="0.05" className="w-24" value={r.metres} onChange={(e) => set(i, { metres: Number(e.target.value) })} />
              </td>
              <td className="p-2">
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove row" disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, k) => k !== i))}>
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t px-4 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, { width: 58, model: "Regular", metres: 1.3 }])}>
          <Plus /> Add row
        </Button>
      </div>
    </section>
  );
}

/** Check the figures before saving: chest + length + sleeve → what an order would show. */
function TryIt({ tables }: { tables: FabricRequirementTables }) {
  const [chest, setChest] = React.useState("13");
  const [length, setLength] = React.useState("28");
  const [sleeve, setSleeve] = React.useState<"full" | "half">("full");
  const r = fabricRequirement(tables, "Shirt", 1, { values: { Chest: num(chest), Length: num(length) } }, sleeve === "full" ? "Full sleeve" : "Half sleeve");
  return (
    <section className="rounded-xl border border-dashed bg-card p-4 text-sm">
      <p className="mb-2 font-medium">
        Try it <span className="text-xs font-normal text-muted-foreground">— with the figures above, saved or not</span>
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs">
          Recorded chest
          <Input aria-label="Try chest" type="number" inputMode="decimal" className="w-24" value={chest} onChange={(e) => setChest(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs">
          Shirt length
          <Input aria-label="Try length" type="number" inputMode="decimal" className="w-24" value={length} onChange={(e) => setLength(e.target.value)} />
        </label>
        <select aria-label="Try sleeve" value={sleeve} onChange={(e) => setSleeve(e.target.value as "full" | "half")} className="h-9 rounded-md border border-input bg-card px-2">
          <option value="full">Full sleeve</option>
          <option value="half">Half sleeve</option>
        </select>
        <p className="min-w-56 flex-1 text-base" data-testid="try-result">
          {r && r.ok ? (
            <>
              <b>തുണി വേണ്ടത്: {metres(r.total)} മീറ്റർ</b> <span className="text-xs text-muted-foreground">({r.rule})</span>
            </>
          ) : r ? (
            <b className="text-warning">{r.missing}</b>
          ) : null}
        </p>
      </div>
    </section>
  );
}
