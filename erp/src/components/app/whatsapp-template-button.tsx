"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, MessageCircle, PenLine, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { listTemplatesForPicker, logMessageSent, type MessageTemplate } from "@/lib/actions/messages";
import {
  MAX_MESSAGE_LENGTH,
  TEMPLATE_CATEGORIES,
  fillTemplate,
  plainAmount,
  templateAvailability,
  type PlaceholderValues,
} from "@/lib/message-template";
import { cn } from "@/lib/utils";
import { formatPhone, toIntlPhone, waMeLink } from "@/lib/phone";

type Props = {
  phone: string | null | undefined;
  /** Second number (e.g. a Gulf WhatsApp) — offered as a choice when present. */
  altPhone?: string | null;
  /** Values for {name} {order_no} {item} {amount} {date} {balance}; {shop} and {phone} come from Settings. */
  values: PlaceholderValues;
  customerId?: number | null;
  orderId?: number | null;
  bulkOrderId?: number | null;
  /** Who the message is for — shown in the dialog title. */
  to: string;
  variant?: "button" | "icon" | "compact";
  className?: string;
};

/**
 * One-customer-at-a-time WhatsApp sender: pick a saved template → edit → open wa.me.
 * Deliberately no "send to all": WhatsApp bans personal numbers used for bulk sending.
 */
export function WhatsAppTemplateButton({ phone, altPhone, values, customerId, orderId, bulkOrderId, to, variant = "button", className }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<{ templates: MessageTemplate[]; shop: string; shopPhone: string } | null>(null);
  const [cat, setCat] = React.useState<string>("All");
  const [picked, setPicked] = React.useState<MessageTemplate | "blank" | null>(null);
  const [text, setText] = React.useState("");
  const [num, setNum] = React.useState("");

  const allValues = React.useMemo<PlaceholderValues>(() => ({ ...values, shop: data?.shop, phone: data?.shopPhone }), [values, data]);

  const start = async () => {
    setOpen(true);
    setPicked(null);
    setCat("All");
    setNum(toIntlPhone(phone) ?? toIntlPhone(altPhone) ?? (phone ?? altPhone ?? "").trim());
    setLoading(true);
    const r = await listTemplatesForPicker();
    setLoading(false);
    if (!r.ok) return void toast.error(r.error);
    setData(r.data);
  };

  const choose = (t: MessageTemplate | "blank") => {
    setPicked(t);
    setText(t === "blank" ? "" : fillTemplate(t.body, { ...values, shop: data?.shop, phone: data?.shopPhone }));
  };

  const intl = toIntlPhone(num);
  const phoneOk = !!intl;
  const main = toIntlPhone(phone);
  const second = toIntlPhone(altPhone);
  const numbers = [main && { n: main, label: "Main" }, second && second !== main && { n: second, label: "Second" }].filter((x): x is { n: string; label: string } => !!x);
  const tooLong = text.length > MAX_MESSAGE_LENGTH;
  const canSend = phoneOk && text.trim().length > 0 && !tooLong;

  const send = () => {
    if (!canSend) return;
    // Open synchronously inside the click so phones/browsers don't block the new tab.
    window.open(waMeLink(intl!, text.trim())!, "_blank", "noopener,noreferrer");
    const tpl = picked && picked !== "blank" ? picked : null;
    setOpen(false);
    logMessageSent({ customerId, orderId, bulkOrderId, templateId: tpl?.id ?? null, templateName: tpl?.name ?? "Own message", phone: intl!, text: text.trim() }).then((r) => {
      if (!r.ok) return void toast.error(`WhatsApp opened, but not saved to history: ${r.error}`);
      toast.success(`WhatsApp opened for ${to}`, { description: "Saved under Messages sent." });
      router.refresh();
    });
  };

  // Templates this record can't fill (e.g. "Payment due" with nothing due) go to the bottom, greyed out with the reason.
  const list = (data?.templates ?? [])
    .filter((t) => cat === "All" || t.category === cat)
    .map((t) => ({ t, a: templateAvailability(t, values) }))
    .sort((x, y) => Number(y.a.ok) - Number(x.a.ok));

  return (
    // Stops clicks inside the dialog from reaching a clickable table row behind it (React events bubble through portals).
    <span className={cn("inline-flex", className)} data-no-row-click onClick={(e) => e.stopPropagation()}>
      {variant === "icon" ? (
        <Button variant="ghost" size="icon-sm" aria-label={`WhatsApp ${to}`} title="WhatsApp message" onClick={start} disabled={!phone && !altPhone}>
          <MessageCircle className="text-success" />
        </Button>
      ) : variant === "compact" ? (
        <Button variant="outline" size="sm" className="h-7 px-2.5" onClick={start} disabled={!phone && !altPhone}>
          <MessageCircle className="text-success" /> WhatsApp
        </Button>
      ) : (
        <Button variant="outline" onClick={start} disabled={!phone && !altPhone}>
          <MessageCircle className="text-success" /> WhatsApp
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {picked && (
                <Button variant="ghost" size="icon-sm" className="-ml-2" aria-label="Back to templates" onClick={() => setPicked(null)}>
                  <ChevronLeft />
                </Button>
              )}
              WhatsApp {to}
            </DialogTitle>
            <DialogDescription>{picked ? "Check the message, change anything, then Send." : "Choose a message — most used first."}</DialogDescription>
          </DialogHeader>

          {!picked ? (
            <div className="grid min-h-0 gap-3">
              <div className="flex flex-wrap gap-1.5">
                {["All", ...TEMPLATE_CATEGORIES].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCat(c)}
                    className={cn("h-7 rounded-full border px-3 text-xs", cat === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="-mx-1 grid min-h-0 gap-1.5 overflow-y-auto px-1 pb-1">
                {loading && (
                  <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading templates…
                  </p>
                )}
                {!loading &&
                  list.map(({ t, a }) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!a.ok}
                      title={a.ok ? undefined : a.reason}
                      onClick={() => choose(t)}
                      className="group flex items-start gap-3 rounded-lg border bg-card p-3 text-left enabled:hover:border-primary/40 enabled:hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{t.name}</span>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {t.category}
                          </Badge>
                        </span>
                        {a.ok ? (
                          <span className="mt-1 line-clamp-2 block font-ml text-xs whitespace-pre-line text-muted-foreground">{fillTemplate(t.body, allValues)}</span>
                        ) : (
                          <span className="mt-1 block text-xs text-muted-foreground">{a.reason}</span>
                        )}
                      </span>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 group-hover:translate-x-0.5" />
                    </button>
                  ))}
                {!loading && data && !list.length && <p className="py-6 text-center text-sm text-muted-foreground">No templates in this category. Add them in Settings → Message templates.</p>}
                {!loading && (
                  <button type="button" onClick={() => choose("blank")} className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-left text-sm text-muted-foreground hover:bg-muted/40">
                    <PenLine className="size-4" /> Write my own message
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="wa-phone">
                  WhatsApp number
                </label>
                {numbers.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {numbers.map(({ n, label }) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNum(n)}
                        className={cn("h-8 rounded-full border px-3 font-mono text-xs", intl === n ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
                      >
                        {label} · {formatPhone(n)}
                      </button>
                    ))}
                  </div>
                )}
                <Input id="wa-phone" inputMode="tel" value={num} onChange={(e) => setNum(e.target.value)} className={cn("font-mono", !phoneOk && "border-warning")} placeholder="+971501234567" />
                {!phoneOk ? (
                  <p className="flex items-center gap-1.5 text-xs text-warning">
                    <AlertTriangle className="size-3.5 shrink-0" /> Can&apos;t read this number. Use a 10-digit Indian mobile, or + and the country code (e.g. +971501234567).
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Opens wa.me/{intl!.slice(1)}</p>
                )}
              </div>
              <div className="grid gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="wa-text">
                    Message {picked !== "blank" && <span className="font-normal">· {picked.name}</span>}
                  </label>
                  <span className={cn("text-[11px] tabular-nums", tooLong ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {text.length} / {MAX_MESSAGE_LENGTH}
                  </span>
                </div>
                <Textarea id="wa-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="font-ml text-sm leading-relaxed" autoFocus={picked === "blank"} />
                {tooLong && <p className="text-xs text-destructive">Too long — shorten it so WhatsApp doesn&apos;t cut it off.</p>}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPicked(null)}>
                  Back
                </Button>
                <Button onClick={send} disabled={!canSend} className="bg-[#1f8f4e] text-white hover:bg-[#1a7a43]">
                  <Send /> Send on WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </span>
  );
}

/** "1 × Shirt, 2 × Pant" → "Shirt, Pant (2)" — reads naturally inside a message. */
export function friendlyItems(items: string | null | undefined) {
  return (items ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(\d+)\s*×\s*(.+)$/);
      if (!m) return s;
      return Number(m[1]) > 1 ? `${m[2]} (${m[1]})` : m[2];
    })
    .join(", ");
}

/** Placeholder values for a stitching or bulk order. */
export function orderMessageValues(o: { name: string; orderNo: string; items?: string | null; total: number; balance: number; deliveryDate?: string | null }): PlaceholderValues {
  const [y, m, d] = (o.deliveryDate ?? "").split("-");
  return {
    name: o.name,
    order_no: o.orderNo,
    item: friendlyItems(o.items) || null,
    amount: plainAmount(o.total),
    balance: o.balance > 0 ? plainAmount(o.balance) : null,
    date: o.deliveryDate ? `${d}-${m}-${y}` : null,
  };
}
