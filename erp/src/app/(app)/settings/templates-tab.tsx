"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/app/field";
import { deleteTemplate, duplicateTemplate, reorderTemplates, saveTemplate, type MessageTemplate, type TemplateInput } from "@/lib/actions/messages";
import { MAX_MESSAGE_LENGTH, PLACEHOLDERS, TEMPLATE_CATEGORIES, fillTemplate, type TemplateCategory } from "@/lib/message-template";
import { cn } from "@/lib/utils";

const SAMPLE = { name: "Rahul", order_no: "SO-0012", item: "2 × Shirt", amount: "1,800", date: "20-11-2026", balance: "800", shop: "SUXUS HERITAGE TAILOR", phone: "98461 86713" };

export function TemplatesTab({ templates }: { templates: MessageTemplate[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(templates);
  const [edit, setEdit] = React.useState<TemplateInput | null>(null);
  const [busy, setBusy] = React.useState<number | null>(null);
  React.useEffect(() => setRows(templates), [templates]);

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next); // move instantly, save in the background
    const r = await reorderTemplates(next.map((t) => t.id));
    if (!r.ok) {
      toast.error(r.error);
      setRows(rows);
    }
  };

  const act = async (id: number, fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(id);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return void toast.error(r.error ?? "Failed");
    toast.success(done);
    router.refresh();
  };

  return (
    <div className="grid max-w-3xl gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-5">
        <div className="text-sm">
          <p className="font-medium">
            Message templates <span className="ml">സന്ദേശങ്ങൾ</span>
          </p>
          <p className="max-w-lg text-muted-foreground">
            Ready messages for the WhatsApp button on customers, stitching orders and bulk orders. One customer at a time — WhatsApp blocks personal numbers that send in bulk.
          </p>
        </div>
        <Button onClick={() => setEdit({ name: "", category: "Greeting", body: "" })}>
          <Plus /> New template
        </Button>
      </div>

      <ul className="grid gap-2">
        {rows.map((t, i) => (
          <li key={t.id} className="flex gap-3 rounded-xl border bg-card p-3">
            <div className="flex flex-col gap-0.5">
              <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.name}</span>
                <Badge variant="secondary">{t.category}</Badge>
                {t.useCount > 0 && <span className="text-[11px] text-muted-foreground">used {t.useCount}×</span>}
              </div>
              <p className="mt-1 line-clamp-3 font-ml text-xs whitespace-pre-line text-muted-foreground">{t.body}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row sm:items-start">
              <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEdit({ id: t.id, name: t.name, category: t.category as TemplateCategory, body: t.body })}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Duplicate" disabled={busy === t.id} onClick={() => act(t.id, () => duplicateTemplate(t.id), "Copied")}>
                <Copy />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete"
                disabled={busy === t.id}
                onClick={() => confirm(`Delete the template "${t.name}"?`) && act(t.id, () => deleteTemplate(t.id), "Deleted")}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          </li>
        ))}
        {!rows.length && <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No templates yet — add one.</li>}
      </ul>

      <TemplateDialog value={edit} onClose={() => setEdit(null)} onSaved={() => router.refresh()} />
    </div>
  );
}

function TemplateDialog({ value, onClose, onSaved }: { value: TemplateInput | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = React.useState<TemplateInput | null>(value);
  const [pending, start] = React.useTransition();
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => setV(value), [value]);
  if (!v) return <Dialog open={false} />;

  const insert = (key: string) => {
    const el = ref.current;
    const token = `{${key}}`;
    const body = v.body ?? "";
    const s = el?.selectionStart ?? body.length;
    const e = el?.selectionEnd ?? body.length;
    setV({ ...v, body: body.slice(0, s) + token + body.slice(e) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + token.length, s + token.length);
    });
  };
  const len = (v.body ?? "").length;

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{v.id ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>Tap a placeholder to put it where the cursor is.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveTemplate(v);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Saved");
              onSaved();
              onClose();
            });
          }}
        >
          <Field label="Short name" ml="പേര്">
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Order ready" required maxLength={60} />
          </Field>
          <Field label="Category" ml="വിഭാഗം">
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setV({ ...v, category: c })}
                  className={cn("h-8 rounded-md border px-3 text-sm", v.category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Message <span className="ml">സന്ദേശം</span>
              </span>
              <span className={cn("text-[11px] tabular-nums", len > MAX_MESSAGE_LENGTH ? "font-medium text-destructive" : "text-muted-foreground")}>
                {len} / {MAX_MESSAGE_LENGTH}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  title={p.label}
                  onClick={() => insert(p.key)}
                  className="h-7 rounded-full border border-primary/30 bg-primary/5 px-2.5 font-mono text-[11px] text-primary hover:bg-primary/10"
                >
                  {`{${p.key}}`}
                </button>
              ))}
            </div>
            <Textarea ref={ref} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} rows={7} className="font-ml text-sm leading-relaxed" required />
          </div>
          {v.body && (
            <div className="rounded-lg border bg-[#e7f6e7] p-3 text-sm dark:bg-[#15301f]">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Preview with sample details</p>
              <p className="font-ml whitespace-pre-line">{fillTemplate(v.body, SAMPLE)}</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || len > MAX_MESSAGE_LENGTH}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
