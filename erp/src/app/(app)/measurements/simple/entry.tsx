"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, Delete, Loader2, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { measuringOrder, wholeOf, type GarmentField } from "@/lib/measurements";
import { saveDraft, deleteDraft, type Draft } from "@/lib/actions/drafts";
import { deleteMeasurement, saveMeasurement } from "@/lib/actions/measurements";
import { today } from "@/lib/utils";

/** Big Malayalam name per field key (part-of-whole fields carry a "how to measure" text instead of a name). */
export const KEY_ML: Record<string, string> = {
  Length: "നീളം",
  Chest: "നെഞ്ച്",
  Waist: "അര",
  Shoulder: "തോൾ",
  Seat: "സീറ്റ്",
  Thigh: "തുട",
  Knee: "മുട്ട്",
  Bottom: "ബോട്ടം",
  Hip: "ഇടുപ്പ്",
  Sleeve: "കൈ നീളം",
  Armhole: "കൈക്കുഴി",
  Neck: "കഴുത്ത്",
  Cuff: "കഫ്",
  Ankle: "കണങ്കാൽ",
};
export const mlOf = (f: GarmentField) => (f.part ? (KEY_ML[f.key] ?? f.ml) : f.ml || KEY_ML[f.key] || f.en);
export const enOf = (f: GarmentField) => (f.part ? f.key : f.en);
const fmt = (n: number | null | undefined) => (n == null ? "" : String(Math.round(n * 100) / 100));

/** How long to wait after the last tap before moving to the next field (time to type a second digit). */
const ADVANCE_MS = 1600;
/** ".5" finishes a number — move on sooner. */
const ADVANCE_HALF_MS = 700;

export type EntryState = {
  draftId?: number;
  customerId: number;
  wearerId: number | null;
  /** Editing an existing record (its id and what it held, for Undo). */
  measurementId?: number | null;
  original?: { date: string; size: string | null; fit: string | null; remarks: string | null; values: Record<string, number | null> } | null;
  garmentType: string;
  size: string | null;
  fit: string | null;
  remarks: string | null;
  values: Record<string, number | null>;
  /** Values the entry started from ("same as last time") — shown as "last time" on each field. */
  previous?: Record<string, number | null> | null;
  step: number;
};

export const fromDraft = (d: Draft): EntryState => ({
  draftId: d.id,
  customerId: d.customerId,
  wearerId: d.wearerId,
  measurementId: d.measurementId,
  garmentType: d.garmentType,
  size: d.size,
  fit: d.fit,
  remarks: d.remarks,
  values: d.values,
  step: d.step,
});

/**
 * Simple-mode entry, full screen: ONE measurement at a time — big Malayalam name, huge number, "4 / 11",
 * a large keypad with ".5", and + / − to nudge by half an inch. Saved as a draft after every field.
 */
export function SimpleEntry({
  initial,
  who,
  order,
  autoAdvance = false,
  onClose,
  onSaved,
}: {
  initial: EntryState;
  /** "Anas · Shirt" — whose and what, shown at the top. */
  who: string;
  order: Record<string, string[]>;
  /** Settings → Measuring order: move on by itself after a pause. Off by default — only Next moves forward. */
  autoAdvance?: boolean;
  onClose: () => void;
  /** After saving: the record id, and how to undo it. */
  onSaved: (r: { id: number; undo: () => Promise<EntryState | null> }) => void;
}) {
  const fields = React.useMemo(() => measuringOrder(initial.garmentType, order), [initial.garmentType, order]);
  const [s, setS] = React.useState<EntryState>(initial);
  // What is being typed in the current field ("" = nothing typed yet → the shown value is the stored one)
  const [typed, setTyped] = React.useState<string | null>(null);
  const [countdown, setCountdown] = React.useState<{ ms: number; at: number } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [draftError, setDraftError] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftId = React.useRef<number | undefined>(initial.draftId);
  const total = fields.length;
  const atSummary = s.step >= total;
  const field = fields[Math.min(s.step, total - 1)];
  const value = s.values[field?.key] ?? null;

  // ── Autosave the draft after every change (debounced) ──
  const persist = React.useCallback(async (st: EntryState) => {
    const r = await saveDraft({
      id: draftId.current,
      customerId: st.customerId,
      wearerId: st.wearerId,
      measurementId: st.measurementId ?? null,
      garmentType: st.garmentType,
      size: st.size,
      fit: st.fit,
      remarks: st.remarks,
      values: st.values,
      step: st.step,
    });
    if (r.ok) {
      draftId.current = r.data.id;
      setDraftError(false);
    } else setDraftError(true);
  }, []);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(s), 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [s, persist]);
  // Phone locked / app switched: save at once
  React.useEffect(() => {
    const flush = () => document.visibilityState === "hidden" && void persist(s);
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [s, persist]);

  const stopTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setCountdown(null);
  };
  React.useEffect(() => stopTimer, []);

  const go = (step: number) => {
    stopTimer();
    setTyped(null);
    setS((x) => ({ ...x, step: Math.max(0, Math.min(total, step)) }));
  };
  const setValue = (v: number | null) => setS((x) => ({ ...x, values: { ...x.values, [field.key]: v } }));
  /** After a change (only when auto-advance is on in Settings): move on by itself, unless another tap comes first. */
  const arm = (ms: number, hasValue: boolean) => {
    stopTimer();
    // Off unless switched on in Settings: a pause to read the tape must never record "1" for "11"
    if (!autoAdvance || !hasValue) return;
    setCountdown({ ms, at: Date.now() });
    timer.current = setTimeout(() => go(s.step + 1), ms);
  };

  const press = (key: string) => {
    navigator.vibrate?.(8);
    // The first key on a field replaces the shown value (like a calculator); later keys add to it
    let t = typed ?? "";
    if (key === "back") t = t.slice(0, -1);
    else if (key === ".") t = t.includes(".") ? t : (t || "0") + ".";
    else if (/^\d$/.test(key)) {
      const [i, d] = t.split(".");
      if (d !== undefined ? d.length >= 2 : i.length >= 3) return; // max 999.99
      t = t === "0" ? key : t + key;
    }
    setTyped(t);
    const n = t === "" || t === "." ? null : Number(t);
    setValue(n);
    arm(ADVANCE_MS, n != null && !t.endsWith("."));
  };
  const half = () => {
    navigator.vibrate?.(8);
    const base = typed != null && typed !== "" ? Math.floor(Number(typed)) : Math.floor(value ?? 0);
    const n = base + 0.5;
    setTyped(String(n));
    setValue(n);
    arm(ADVANCE_HALF_MS, true);
  };
  const nudge = (d: number) => {
    navigator.vibrate?.(8);
    const n = Math.max(0, Math.round(((value ?? 0) + d) * 100) / 100);
    setTyped(String(n));
    setValue(n);
    arm(ADVANCE_MS, true);
  };

  const finish = async () => {
    setSaving(true);
    const values = Object.fromEntries(Object.entries(s.values).filter(([, v]) => v != null)) as Record<string, number>;
    const r = await saveMeasurement({
      id: s.measurementId ?? undefined,
      customerId: s.customerId,
      wearerId: s.wearerId,
      date: s.original?.date ?? today(),
      garmentType: s.garmentType,
      size: s.size,
      fit: s.fit ?? "Regular",
      values,
      remarks: s.remarks,
    });
    setSaving(false);
    if (!r.ok) return void toast.error(r.error);
    if (draftId.current) await deleteDraft(draftId.current);
    const saved = { ...s, draftId: undefined };
    onSaved({
      id: r.data.id,
      // Undo: take the save back and return to the final check with every value still there
      undo: async () => {
        const u = saved.measurementId && saved.original
          ? await saveMeasurement({ id: saved.measurementId, customerId: saved.customerId, wearerId: saved.wearerId, garmentType: saved.garmentType, ...saved.original })
          : await deleteMeasurement(r.data.id);
        if (!u.ok) {
          toast.error(u.error);
          return null;
        }
        return { ...saved, step: total };
      },
    });
  };

  const close = async () => {
    stopTimer();
    await persist(s);
    onClose();
  };

  // Hardware keyboard (or a Bluetooth keypad) works too
  React.useEffect(() => {
    if (atSummary) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key) || e.key === ".") press(e.key);
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Enter" || e.key === "ArrowRight") go(s.step + 1);
      else if (e.key === "ArrowLeft") go(s.step - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const shown = typed != null ? typed : fmt(value);
  const whole = field && !atSummary ? wholeOf(field, value) : null;
  const last = s.previous?.[field?.key];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`Measuring ${who}`}>
      {/* Top: whose, progress, close */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <button type="button" onClick={close} aria-label="Close — the entry is kept" className="grid size-14 shrink-0 place-items-center rounded-xl hover:bg-muted">
          <X className="size-7" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg leading-tight font-semibold">{who}</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(Math.min(s.step, total) / total) * 100}%` }} />
            </div>
            <span className="shrink-0 text-base font-semibold tabular-nums" aria-label="progress">
              {atSummary ? `${total} / ${total}` : `${s.step + 1} / ${total}`}
            </span>
          </div>
        </div>
      </div>
      {draftError && <p className="bg-warning/15 px-4 py-1 text-center text-sm">Not saved yet — check the internet · ഇന്റർനെറ്റ് നോക്കുക</p>}

      {atSummary ? (
        <Summary
          fields={fields}
          s={s}
          onPick={go}
          saving={saving}
          onSave={finish}
          onBack={() => go(total - 1)}
          onRemarks={(remarks) => setS((x) => ({ ...x, remarks }))}
        />
      ) : (
        <>
          {/* The field: Malayalam big, English small; the number huge */}
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
            <p className="font-ml text-4xl leading-tight font-bold sm:text-5xl">{mlOf(field)}</p>
            <p className="text-lg text-muted-foreground">{enOf(field)}</p>
            {field.part && <p className="font-ml text-sm text-muted-foreground">{field.ml}</p>}
            <p className={cn("mt-2 min-h-[1.1em] text-[5.5rem] leading-none font-bold tabular-nums sm:text-[7rem]", shown === "" && "text-muted-foreground/40")} aria-live="polite" data-testid="value">
              {shown === "" ? "—" : shown}
            </p>
            <p className="min-h-6 text-lg text-muted-foreground">
              {whole != null ? `${field.part!.whole} ${whole}` : ""}
              {last != null && last !== value ? `${whole != null ? " · " : ""}last time ${fmt(last)}` : ""}
            </p>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-transparent">
              {countdown && <div key={countdown.at} className="h-1.5 rounded-full bg-primary/60" style={{ animation: `shrink ${countdown.ms}ms linear forwards` }} />}
            </div>
          </div>

          {/* Keypad: digits, ".", ".5", backspace — and + / − beside it */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1.1fr] gap-2 px-3 pb-2">
            {["7", "8", "9"].map((k) => (
              <Key key={k} onClick={() => press(k)}>{k}</Key>
            ))}
            <Key onClick={() => nudge(0.5)} tone="nudge" label="Plus half inch">
              <Plus className="size-8" />
              <span className="text-base">0.5</span>
            </Key>
            {["4", "5", "6"].map((k) => (
              <Key key={k} onClick={() => press(k)}>{k}</Key>
            ))}
            <Key onClick={() => nudge(-0.5)} tone="nudge" label="Minus half inch">
              <Minus className="size-8" />
              <span className="text-base">0.5</span>
            </Key>
            {["1", "2", "3"].map((k) => (
              <Key key={k} onClick={() => press(k)}>{k}</Key>
            ))}
            <Key onClick={half} tone="half" label="Point five">
              .5
            </Key>
            <Key onClick={() => press(".")} label="Decimal point">.</Key>
            <Key onClick={() => press("0")}>0</Key>
            <Key onClick={() => press("back")} tone="muted" label="Backspace">
              <Delete className="size-8" />
            </Key>
            <Key onClick={() => (setTyped(""), setValue(null), stopTimer())} tone="muted" label="Clear">
              <span className="text-lg">Clear</span>
            </Key>
          </div>

          {/* Back / Next */}
          <div className="grid grid-cols-[1fr_2fr] gap-2 border-t p-3">
            <button type="button" onClick={() => go(s.step - 1)} disabled={s.step === 0} className="flex h-16 items-center justify-center gap-2 rounded-2xl border-2 text-lg font-semibold disabled:opacity-30">
              <ArrowLeft className="size-6" /> Back
            </button>
            <button type="button" onClick={() => go(s.step + 1)} className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
              {s.step === total - 1 ? "Check · നോക്കുക" : "Next · അടുത്തത്"} <ArrowRight className="size-6" />
            </button>
          </div>
        </>
      )}
      <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
    </div>
  );
}

function Key({ children, onClick, tone, label }: { children: React.ReactNode; onClick: () => void; tone?: "nudge" | "half" | "muted"; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? String(children)}
      className={cn(
        "flex h-16 min-h-14 items-center justify-center gap-1 rounded-2xl border-2 text-4xl font-semibold tabular-nums select-none active:scale-95 sm:h-[4.5rem]",
        !tone && "bg-card",
        tone === "nudge" && "border-primary/40 bg-primary/10 text-primary",
        tone === "half" && "border-gold bg-gold/25",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** The final check: every value large; tap one to change it; then Save. */
function Summary({
  fields,
  s,
  onPick,
  onSave,
  onBack,
  saving,
  onRemarks,
}: {
  fields: GarmentField[];
  s: EntryState;
  onPick: (step: number) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
  onRemarks: (r: string | null) => void;
}) {
  const filled = fields.filter((f) => s.values[f.key] != null).length;
  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-2 text-center font-ml text-2xl font-bold">
          ഒന്ന് നോക്കുക <span className="block font-sans text-base font-normal text-muted-foreground">Check once — tap a number to change it</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f, i) => {
            const v = s.values[f.key];
            const whole = wholeOf(f, v);
            return (
              <button key={f.key} type="button" onClick={() => onPick(i)} className={cn("min-h-20 rounded-2xl border-2 bg-card px-3 py-2 text-left", v == null && "border-dashed")}>
                <span className="block font-ml text-lg leading-tight font-semibold">{mlOf(f)}</span>
                <span className="block text-xs text-muted-foreground">{enOf(f)}</span>
                <span className={cn("block text-3xl font-bold tabular-nums", v == null && "text-muted-foreground/50")}>{v == null ? "—" : fmt(v)}</span>
                {whole != null && <span className="block text-sm text-muted-foreground">{f.part!.whole} {whole}</span>}
              </button>
            );
          })}
        </div>
        <details className="mt-3 rounded-2xl border p-3">
          <summary className="flex min-h-14 cursor-pointer items-center gap-1 text-base font-medium">
            Note <span className="font-ml text-sm text-muted-foreground">കുറിപ്പ്</span> {s.remarks ? `· ${s.remarks}` : "(optional)"}
          </summary>
          <textarea defaultValue={s.remarks ?? ""} onBlur={(e) => onRemarks(e.target.value || null)} rows={2} className="mt-2 w-full rounded-xl border bg-card p-2 text-base" placeholder="Pocket, collar…" />
        </details>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2 border-t p-3">
        <button type="button" onClick={onBack} className="flex h-16 items-center justify-center gap-2 rounded-2xl border-2 text-lg font-semibold">
          <ArrowLeft className="size-6" /> Back
        </button>
        <button type="button" onClick={onSave} disabled={saving || filled === 0} className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-success text-xl font-bold text-white disabled:opacity-50">
          {saving ? <Loader2 className="size-6 animate-spin" /> : <Check className="size-7" />} Save · സേവ്
        </button>
      </div>
    </>
  );
}
