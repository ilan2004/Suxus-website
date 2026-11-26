"use client";

import * as React from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listWearers, saveWearer } from "@/lib/actions/wearers";
import { RELATIONS, RELATION_ML, wearerTitle, type WearerLite } from "@/lib/wearers";
import { cn } from "@/lib/utils";

/** The chosen customer's wearers (Self first). Reloads when the customer changes. */
export function useWearers(customerId: number | null | undefined) {
  const [wearers, setWearers] = React.useState<WearerLite[]>([]);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    if (!customerId) return void setWearers([]);
    setLoading(true);
    listWearers(customerId)
      .then((w) => live && setWearers(w))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [customerId]);
  const add = (w: WearerLite) => setWearers((ws) => [...ws.filter((x) => x.id !== w.id), w]);
  const self = wearers.find((w) => w.isSelf) ?? null;
  return { wearers, loading, add, self, many: wearers.length > 1 };
}

/** Compact dropdown of a customer's wearers. */
export function WearerSelect({
  wearers,
  value,
  onChange,
  className,
  ariaLabel = "Whose garment",
}: {
  wearers: WearerLite[];
  value: number | null | undefined;
  onChange: (id: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const self = wearers.find((w) => w.isSelf);
  return (
    <select
      aria-label={ariaLabel}
      value={value ?? self?.id ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn("h-9 min-w-0 rounded-md border border-input bg-card px-2 text-sm font-medium", className)}
    >
      {wearers.map((w) => (
        <option key={w.id} value={w.id}>
          {wearerTitle(w)}
        </option>
      ))}
    </select>
  );
}

/** Inline "add another person" — name, relation, school / class. Creates the wearer straight away. */
export function AddPersonForm({
  customerId,
  onAdded,
  onCancel,
  initial,
}: {
  customerId: number;
  onAdded: (w: WearerLite) => void;
  onCancel: () => void;
  /** Edit an existing person instead (Self: only school / note). */
  initial?: WearerLite;
}) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [relation, setRelation] = React.useState<(typeof RELATIONS)[number]>((initial?.relation as (typeof RELATIONS)[number]) ?? "Son");
  const [school, setSchool] = React.useState(initial?.school ?? "");
  const [note, setNote] = React.useState(initial?.note ?? "");
  const [pending, start] = React.useTransition();
  const isSelf = !!initial?.isSelf;
  const save = () => {
    if (!name.trim()) return void toast.error("Enter the person's name");
    start(async () => {
      const r = await saveWearer({ id: initial?.id, customerId, name, relation: isSelf ? "Self" : relation, school: school || null, note: note || null });
      if (!r.ok) return void toast.error(r.error);
      toast.success(initial ? `${isSelf ? "Self" : r.data.name} saved` : `${r.data.name} added`);
      onAdded(r.data);
    });
  };
  return (
    // Not a <form>: it sits inside other forms
    <div className="grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {initial ? "Edit person" : "Add another person"} <span className="ml">{initial ? "ആൾ" : "മറ്റൊരാളെ ചേർക്കുക"}</span>
        </p>
        <button type="button" onClick={onCancel} aria-label="Close" className="grid size-6 place-items-center rounded hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_130px_1fr]">
        <Input autoFocus={!isSelf} disabled={isSelf} value={isSelf ? "Self · സ്വന്തം" : name} onChange={(e) => setName(e.target.value)} placeholder="Name · പേര്" aria-label="Person's name" />
        <select
          aria-label="Relation"
          disabled={isSelf}
          value={isSelf ? "Self" : relation}
          onChange={(e) => setRelation(e.target.value as (typeof RELATIONS)[number])}
          className="h-9 rounded-md border border-input bg-card px-2 text-sm"
        >
          {RELATIONS.filter((r) => isSelf || r !== "Self").map((r) => (
            <option key={r} value={r}>
              {r} · {RELATION_ML[r]}
            </option>
          ))}
        </select>
        <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="School / class (optional)" aria-label="School / class" />
      </div>
      {initial && <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />}
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} {initial ? "Save" : "Add person"}
        </Button>
      </div>
    </div>
  );
}

/**
 * "Whose measurements" for a form. With only the Self wearer it shows nothing but a small "+ Add another person"
 * link — single-person work looks exactly as before.
 */
export function WearerField({
  customerId,
  value,
  onChange,
  hook,
}: {
  customerId: number | null | undefined;
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  hook: ReturnType<typeof useWearers>;
}) {
  const [adding, setAdding] = React.useState(false);
  React.useEffect(() => setAdding(false), [customerId]);
  // No list at all = the database does not have Wearers yet (with it, every customer has at least Self)
  if (!customerId || hook.loading || !hook.wearers.length) return null;
  const { wearers, many, add } = hook;
  return (
    <div className="grid gap-2 sm:col-span-2">
      {many && (
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">
            Whose measurements <span className="ml">ആളുടെ അളവ്</span> <span className="text-destructive">*</span>
          </p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Whose measurements">
            {wearers.map((w) => {
              const on = (value ?? hook.self?.id) === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(w.id)}
                  className={cn("h-9 rounded-full border px-3 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
                >
                  {wearerTitle(w)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {adding ? (
        <AddPersonForm
          customerId={customerId}
          onCancel={() => setAdding(false)}
          onAdded={(w) => {
            add(w);
            onChange(w.id);
            setAdding(false);
          }}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          <UserPlus className="size-3.5" /> Add another person (son, daughter…)
        </button>
      )}
    </div>
  );
}
