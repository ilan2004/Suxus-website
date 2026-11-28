"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newShopQr, newTryonCode, stopTryonCode } from "@/lib/actions/tryon";
import { cn } from "@/lib/utils";

type Code = { code: string; tries: number; used: number; exp: number; note: string; by: string };

const message = (c: { code: string; tries: number }, url: string) =>
  `SUXUS Heritage Tailor — നിങ്ങളുടെ ട്രൈ-ഓൺ കോഡ്: ${c.code}\n${c.tries} ട്രൈ-ഓൺ, 7 ദിവസം. ${url} തുറന്ന് "കോഡ് ഉണ്ടോ?" എന്നതിൽ ഈ കോഡ് നൽകുക.\nYour try-on code: ${c.code} (${c.tries} try-on${c.tries > 1 ? "s" : ""}, 7 days).`;

/** Settings > Try-on > Website lock: WhatsApp codes for website visitors, and a new shop QR. */
export function WebCodes({ active, tryonUrl }: { active: Code[]; tryonUrl: string }) {
  const router = useRouter();
  const [tries, setTries] = React.useState(2);
  const [note, setNote] = React.useState("");
  const [made, setMade] = React.useState<Code | null>(null);
  const [pending, start] = React.useTransition();
  const copy = (c: Code) => void navigator.clipboard?.writeText(message(c, tryonUrl)).then(() => toast.success("Message copied — paste it in WhatsApp"));
  return (
    <section className="grid gap-3 rounded-xl border bg-card p-5" data-testid="web-codes">
      <p className="flex items-center gap-2 font-medium">
        <KeyRound className="size-4" /> WhatsApp codes <span className="ml">ട്രൈ-ഓൺ കോഡ്</span>
      </p>
      <p className="text-xs text-muted-foreground">
        A website visitor who used their free try-on WhatsApps you; make a code here and send it. Each code: 6 digits, the try-ons you choose, 7 days. It does
        not use the shop&apos;s or the website&apos;s daily count — only the monthly cap.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1 text-sm">
          <span className="font-medium">Try-ons</span>
          <div className="grid grid-cols-3 gap-1 rounded-md border bg-muted p-0.5">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" onClick={() => setTries(n)} className={cn("h-8 w-10 rounded text-sm", tries === n ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")} aria-pressed={tries === n}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="grid min-w-40 flex-1 gap-1 text-sm">
          <span className="font-medium">For (name / phone, optional)</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="Rahul 98xxxxxx" />
        </label>
        <Button
          type="button"
          disabled={pending}
          data-testid="new-code"
          onClick={() =>
            start(async () => {
              const r = await newTryonCode(tries, note);
              if (!r.ok) return void toast.error(r.error);
              setMade(r.data);
              setNote("");
              router.refresh();
            })
          }
        >
          {pending && <Loader2 className="animate-spin" />} Make a code
        </Button>
      </div>
      {made && (
        <div className="grid gap-2 rounded-lg border-2 border-primary/40 bg-primary/5 p-3" data-testid="made-code">
          <p className="font-mono text-3xl font-semibold tracking-[0.3em]">{made.code}</p>
          <p className="text-xs text-muted-foreground">
            {made.tries} try-on{made.tries > 1 ? "s" : ""} · 7 days
          </p>
          <Button type="button" variant="outline" onClick={() => copy(made)}>
            <Copy /> Copy WhatsApp message
          </Button>
        </div>
      )}
      {active.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm" data-testid="code-list">
          {active.map((c) => (
            <li key={c.code} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <b className="font-mono tracking-widest">{c.code}</b>
              <span className="text-muted-foreground">
                {c.tries - c.used} of {c.tries} left · till {new Date(c.exp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {c.note ? ` · ${c.note}` : ""}
              </span>
              <span className="ml-auto flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => copy(c)} aria-label="Copy message">
                  <Copy />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await stopTryonCode(c.code);
                      if (!r.ok) return void toast.error(r.error);
                      router.refresh();
                    })
                  }
                >
                  Stop
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (!confirm("Make a new shop QR? Every QR printed until now will count as the website (1 try-on per phone). Reprint the poster and labels after this.")) return;
            start(async () => {
              const r = await newShopQr();
              if (!r.ok) return void toast.error(r.error);
              toast.success("New shop QR — reprint the poster and labels");
              router.refresh();
            });
          }}
        >
          <QrCode /> New shop QR (if the old one was shared)
        </Button>
      </div>
    </section>
  );
}
