"use client";

import * as React from "react";
import { ArrowLeft, Camera, Check, Download, Image as ImageIcon, Loader2, RefreshCw, Search, Shirt, Sparkles, SwitchCamera, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────────────────── Words (Malayalam first, English second) ───────────────────────── */

const W = {
  welcome: ["ഞങ്ങളുടെ തുണിയിൽ തയ്ച്ച ഷർട്ട് നിങ്ങളുടെ ഫോട്ടോയിൽ കാണാം", "See a shirt in our fabric on yourself"],
  start: ["തുടങ്ങാം", "Start"],
  garment: ["ഷർട്ട് — ഏത് തരം?", "Shirt — which kind?"],
  fabric: ["തുണി തിരഞ്ഞെടുക്കുക", "Choose a fabric"],
  search: ["പേര്, കോഡ്, നിറം", "Name, code or colour"],
  all: ["എല്ലാം", "All"],
  perMetre: ["/ മീറ്റർ", "/ metre"],
  noMatch: ["ഈ തിരച്ചിലിൽ തുണി ഇല്ല", "No fabric matches"],
  consentTitle: ["ഫോട്ടോയെക്കുറിച്ച്", "About your photo"],
  consent: [
    "ഈ പ്രിവ്യൂ ഉണ്ടാക്കാൻ മാത്രമാണ് ഫോട്ടോ ഉപയോഗിക്കുന്നത്. ആരുമായും പങ്കുവെക്കില്ല. 7 ദിവസത്തിനുള്ളിൽ ഡിലീറ്റ് ചെയ്യും.",
    "Your photo is used only to create this preview. It is not shared with anyone and is deleted after 7 days.",
  ],
  agree: ["ശരി, ക്യാമറ തുറക്കുക", "OK, open the camera"],
  gallery: ["ഗാലറിയിൽ നിന്ന്", "Choose from gallery"],
  standHint: ["മുഖവും തോളും വരയ്ക്കുള്ളിൽ വരട്ടെ", "Keep your face and shoulders inside the outline"],
  toBack: ["പിൻ ക്യാമറ", "Back camera"],
  toFront: ["മുൻ ക്യാമറ", "Front camera"],
  capture: ["ഫോട്ടോ എടുക്കുക", "Take photo"],
  retake: ["വീണ്ടും എടുക്കുക", "Retake"],
  usePhoto: ["ഈ ഫോട്ടോ മതി — ഉണ്ടാക്കുക", "Use this photo — create"],
  generating: ["നിങ്ങളുടെ ഷർട്ട് ഉണ്ടാക്കുന്നു…", "Making your shirt…"],
  generatingNote: ["സാധാരണ 15–40 സെക്കൻഡ് എടുക്കും. ഈ പേജ് അടയ്ക്കരുത്.", "This usually takes 15–40 seconds. Please keep this page open."],
  save: ["സേവ് ചെയ്യുക", "Save"],
  share: ["WhatsApp-ൽ അയക്കുക", "Share on WhatsApp"],
  another: ["മറ്റൊരു തുണി നോക്കാം", "Try another fabric"],
  want: ["എനിക്ക് ഇത് വേണം", "I want this"],
  wantNote: ["ഈ സ്ക്രീൻ കൗണ്ടറിൽ കാണിക്കുക", "Show this screen at the counter"],
  disclaimer: [
    "സ്ക്രീനിലെ നിറം യഥാർത്ഥ തുണിയിൽ നിന്ന് അല്പം വ്യത്യാസപ്പെടാം. ഓർഡർ ചെയ്യുന്നതിന് മുമ്പ് തുണി നേരിട്ട് കാണുക.",
    "Screen colours can differ slightly from the actual cloth. Please see the fabric before ordering.",
  ],
  retry: ["വീണ്ടും ശ്രമിക്കുക", "Try again"],
  back: ["തിരികെ", "Back"],
  close: ["അടയ്ക്കുക", "Close"],
  notCounted: ["ഈ ശ്രമം എണ്ണത്തിൽ കൂട്ടിയിട്ടില്ല.", "This attempt was not counted."],
} as const;

const ERR: Record<string, readonly [string, string]> = {
  limit: ["ഇന്നത്തെ ട്രൈ-ഓൺ കഴിഞ്ഞു. നാളെ വീണ്ടും ശ്രമിക്കുക, അല്ലെങ്കിൽ കൗണ്ടറിൽ ചോദിക്കുക.", "Today's try-ons are used up. Please try again tomorrow, or ask at the counter."],
  network: ["ഇന്റർനെറ്റ് വേഗത കുറവാണ് അല്ലെങ്കിൽ കണക്ഷൻ പോയി. ഒന്നുകൂടി ശ്രമിക്കുക.", "The internet is slow or disconnected. Please try again."],
  timeout: ["ഇതിന് പതിവിലും സമയമെടുത്തു. ഒന്നുകൂടി ശ്രമിക്കുക.", "This took longer than usual. Please try again."],
  busy: ["സിസ്റ്റം ഇപ്പോൾ തിരക്കിലാണ്. ഒരു മിനിറ്റ് കഴിഞ്ഞ് ശ്രമിക്കുക.", "The system is busy right now. Please try again in a minute."],
  blocked: ["ഈ ഫോട്ടോയിൽ നിന്ന് ഉണ്ടാക്കാൻ കഴിഞ്ഞില്ല. മുഖവും തോളും വ്യക്തമായി കാണുന്ന മറ്റൊരു ഫോട്ടോ എടുക്കുക.", "We could not create a preview from this photo. Please take another with your face and shoulders clearly visible."],
  bad_photo: ["ഫോട്ടോ തുറക്കാൻ കഴിഞ്ഞില്ല. മറ്റൊരു ഫോട്ടോ ശ്രമിക്കുക.", "We could not open that photo. Please try another one."],
  camera: ["ക്യാമറ തുറക്കാൻ അനുവാദം കിട്ടിയില്ല. ബ്രൗസറിൽ ക്യാമറ അനുവദിക്കുക, അല്ലെങ്കിൽ ഗാലറിയിൽ നിന്ന് ഫോട്ടോ തിരഞ്ഞെടുക്കുക.", "Camera access was not allowed. Allow the camera in your browser, or choose a photo from your gallery."],
  no_fabrics: ["ഇപ്പോൾ ട്രൈ ചെയ്യാൻ തുണി ലഭ്യമല്ല. കൗണ്ടറിൽ ചോദിക്കുക.", "No fabrics are available to try right now. Please ask at the counter."],
  fabrics: ["തുണികൾ ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ഒന്നുകൂടി ശ്രമിക്കുക.", "Could not load the fabrics. Please try again."],
  unavailable: ["ട്രൈ-ഓൺ ഇപ്പോൾ ലഭ്യമല്ല. കൗണ്ടറിൽ ചോദിക്കുക.", "Try-on is not available right now. Please ask at the counter."],
  generic: ["ഇപ്പോൾ ഉണ്ടാക്കാൻ കഴിഞ്ഞില്ല. ഒന്നുകൂടി ശ്രമിക്കുക.", "We could not create it right now. Please try again."],
};
const errOf = (code: string) => ERR[code] ?? ERR.generic;
/** The attempt did not use up one of the day's try-ons (only successes count). */
const NOT_COUNTED = new Set(["network", "timeout", "busy", "blocked", "bad_photo", "generic", "api", "config", "fabric_photo"]);

const VARIANT_ML: Record<string, string> = { "full sleeve": "ഫുൾ കൈ", "half sleeve": "ഹാഫ് കൈ" };

type Fabric = { id: number; code: string; name: string; colour: string | null; colourFamily: string | null; pattern: string | null; hex: string | null; rate: number; thumb: string; photo: string };
type Step = "welcome" | "garment" | "fabric" | "consent" | "camera" | "preview" | "generating" | "result" | "error";

/* ───────────────────────── App ───────────────────────── */

export function TryOnApp({ phone, variants }: { phone: string; variants: string[] }) {
  const [lang, setLang] = React.useState<"ml" | "en">("ml");
  /** [primary, secondary] in the chosen language order */
  const t = (w: readonly [string, string]): [string, string] => (lang === "ml" ? [w[0], w[1]] : [w[1], w[0]]);
  const [step, setStep] = React.useState<Step>("welcome");
  const [variant, setVariant] = React.useState<string | null>(null);
  const [fabric, setFabric] = React.useState<Fabric | null>(null);
  const [fabrics, setFabrics] = React.useState<Fabric[] | null>(null);
  const [fabricErr, setFabricErr] = React.useState<string | null>(null);
  const [photo, setPhoto] = React.useState<{ blob: Blob; url: string } | null>(null);
  const [left, setLeft] = React.useState<{ left: number; limit: number } | null>(null);
  const [result, setResult] = React.useState<{ url: string } | null>(null);
  const [error, setError] = React.useState<{ code: string; back: Step } | null>(null);
  const [want, setWant] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    try {
      const r = await fetch("/api/tryon/status", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setLeft({ left: j.left, limit: j.limit });
      else if (j.error === "unavailable") setError({ code: "unavailable", back: "welcome" });
    } catch {
      /* the counter just stays hidden */
    }
  }, []);
  const loadFabrics = React.useCallback(async () => {
    setFabricErr(null);
    try {
      const r = await fetch("/api/tryon/fabrics", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error();
      setFabrics(j.fabrics);
      if (!j.fabrics.length) setFabricErr("no_fabrics");
    } catch {
      setFabricErr("fabrics");
    }
  }, []);
  React.useEffect(() => {
    void loadStatus();
    void loadFabrics();
  }, [loadStatus, loadFabrics]);

  const fail = (code: string, back: Step) => {
    setError({ code, back });
    setStep("error");
  };

  const generate = async (blob: Blob, f: Fabric) => {
    if (!variant) return setStep("garment");
    if (left && left.left <= 0) return fail("limit", "result");
    setStep("generating");
    const fd = new FormData();
    fd.append("photo", blob, "photo.jpg");
    fd.append("fabricId", String(f.id));
    fd.append("variant", variant);
    try {
      const r = await fetch("/api/tryon/generate", { method: "POST", body: fd, signal: AbortSignal.timeout(130_000) });
      const j = await r.json().catch(() => ({ ok: false, error: "generic" }));
      if (typeof j.left === "number") setLeft({ left: j.left, limit: j.limit });
      if (!j.ok) return fail(j.error ?? "generic", j.error === "blocked" || j.error === "bad_photo" ? "camera" : "preview");
      setResult({ url: j.image });
      setWant(false);
      setStep("result");
    } catch (e) {
      fail((e as Error).name === "TimeoutError" ? "timeout" : "network", "preview");
    }
  };

  const counter = left && (
    <p className="text-center text-sm text-muted-foreground" data-testid="tryon-counter">
      {lang === "ml" ? (
        <>
          <span className="font-ml">ഇന്ന് {left.limit}-ൽ {left.left} ട്രൈ-ഓൺ ബാക്കി</span> · {left.left} of {left.limit} try-ons left
        </>
      ) : (
        <>
          {left.left} of {left.limit} try-ons left · <span className="font-ml">ഇന്ന് {left.limit}-ൽ {left.left} ബാക്കി</span>
        </>
      )}
    </p>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-2 border-b py-3">
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight font-semibold tracking-[0.14em] text-primary">SUXUS HERITAGE TAILOR</p>
            <p className="text-xs text-muted-foreground">
              Pallikkal Bazar · <a href={`tel:${phone.split("|")[0].replace(/\s/g, "")}`}>{phone}</a>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLang((l) => (l === "ml" ? "en" : "ml"))}
            className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-sm font-medium"
            aria-label="Language"
            data-testid="lang-toggle"
          >
            {lang === "ml" ? "English" : "മലയാളം"}
          </button>
        </header>

        <main className="flex flex-1 flex-col pt-4">
          {step === "welcome" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <div className="grid size-20 place-items-center rounded-full bg-primary/10 text-primary">
                <Shirt className="size-10" />
              </div>
              <Title w={t(W.welcome)} lang={lang} big />
              {counter}
              <Big onClick={() => setStep("garment")} testid="start">
                <Label w={t(W.start)} lang={lang} />
              </Big>
            </div>
          )}

          {step === "garment" && (
            <div className="grid gap-4">
              <Title w={t(W.garment)} lang={lang} />
              <div className="grid grid-cols-2 gap-3">
                {variants.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setVariant(v);
                      setStep("fabric");
                    }}
                    data-testid={`variant-${v}`}
                    className={cn("flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-card p-3", variant === v && "border-primary")}
                  >
                    <SleeveIcon half={/half/i.test(v)} />
                    <Label w={t([VARIANT_ML[v.toLowerCase()] ?? v, v])} lang={lang} />
                  </button>
                ))}
              </div>
              <BackLink onClick={() => setStep("welcome")} w={t(W.back)} />
            </div>
          )}

          {step === "fabric" && (
            <FabricStep
              fabrics={fabrics}
              err={fabricErr}
              lang={lang}
              t={t}
              onRetry={loadFabrics}
              onBack={() => setStep("garment")}
              onPick={(f) => {
                setFabric(f);
                // "Try another fabric": the same photo, straight to the new shirt
                if (photo) void generate(photo.blob, f);
                else setStep("consent");
              }}
            />
          )}

          {step === "consent" && (
            <div className="flex flex-1 flex-col justify-center gap-5">
              <Title w={t(W.consentTitle)} lang={lang} />
              <div className="rounded-2xl border bg-card p-4" data-testid="consent">
                <p className={cn("text-base leading-relaxed", lang === "ml" && "font-ml")}>{t(W.consent)[0]}</p>
                <p className={cn("mt-2 text-sm text-muted-foreground", lang === "en" && "font-ml")}>{t(W.consent)[1]}</p>
              </div>
              <Big onClick={() => setStep("camera")} testid="agree">
                <Camera className="size-5" /> <Label w={t(W.agree)} lang={lang} />
              </Big>
              <BackLink onClick={() => setStep("fabric")} w={t(W.back)} />
            </div>
          )}

          {step === "camera" && (
            <CameraStep
              lang={lang}
              t={t}
              onPhoto={(blob) => {
                setPhoto((p) => {
                  if (p) URL.revokeObjectURL(p.url);
                  return { blob, url: URL.createObjectURL(blob) };
                });
                setStep("preview");
              }}
              onDenied={() => fail("camera", "camera")}
              onBadFile={() => fail("bad_photo", "camera")}
              onBack={() => setStep("fabric")}
            />
          )}

          {step === "preview" && photo && fabric && (
            <div className="grid gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="aspect-[3/4] w-full rounded-2xl bg-muted object-contain" data-testid="preview-image" />
              <FabricChip f={fabric} variant={variant} lang={lang} />
              {counter}
              <Big onClick={() => void generate(photo.blob, fabric)} testid="use-photo">
                <Sparkles className="size-5" /> <Label w={t(W.usePhoto)} lang={lang} />
              </Big>
              <Big variant="outline" onClick={() => setStep("camera")}>
                <RefreshCw className="size-5" /> <Label w={t(W.retake)} lang={lang} />
              </Big>
            </div>
          )}

          {step === "generating" && <Generating lang={lang} t={t} photo={photo?.url} />}

          {step === "result" && result && fabric && (
            <div className="grid gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.url} alt="" className="w-full rounded-2xl border shadow-sm" data-testid="result-image" />
              <FabricChip f={fabric} variant={variant} lang={lang} />
              <p className="rounded-xl bg-muted px-3 py-2 text-sm" data-testid="disclaimer">
                <span className={cn("block", lang === "ml" && "font-ml")}>{t(W.disclaimer)[0]}</span>
                <span className={cn("block text-xs text-muted-foreground", lang === "en" && "font-ml")}>{t(W.disclaimer)[1]}</span>
              </p>
              {want ? (
                <div className="rounded-2xl border-2 border-gold bg-gold/15 p-4 text-center" data-testid="want-panel">
                  <p className="font-display text-3xl font-semibold">{fabric.code}</p>
                  <p className="text-sm">{fabric.name}</p>
                  <p className={cn("mt-2 text-lg font-semibold", lang === "ml" && "font-ml")}>{t(W.wantNote)[0]}</p>
                  <p className="text-xs text-muted-foreground">{t(W.wantNote)[1]}</p>
                </div>
              ) : (
                <Big variant="gold" onClick={() => setWant(true)} testid="want">
                  <Check className="size-5" /> <Label w={t(W.want)} lang={lang} />
                </Big>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Big variant="outline" onClick={() => void saveImage(result.url, fabric.code)}>
                  <Download className="size-5" /> <Label w={t(W.save)} lang={lang} small />
                </Big>
                <Big variant="outline" onClick={() => void shareImage(result.url, fabric, phone)}>
                  <WhatsAppIcon /> <Label w={t(W.share)} lang={lang} small />
                </Big>
              </div>
              {counter}
              {left && left.left > 0 && (
                <Big variant="outline" onClick={() => setStep("fabric")} testid="another">
                  <Shirt className="size-5" /> <Label w={t(W.another)} lang={lang} />
                </Big>
              )}
            </div>
          )}

          {step === "error" && error && (
            <div className="flex flex-1 flex-col justify-center gap-4 text-center" data-testid="tryon-error">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-warning/15 text-warning">
                <X className="size-8" />
              </div>
              <p className={cn("text-lg leading-relaxed font-medium", lang === "ml" && "font-ml")}>{t(errOf(error.code))[0]}</p>
              <p className={cn("text-sm text-muted-foreground", lang === "en" && "font-ml")}>{t(errOf(error.code))[1]}</p>
              {NOT_COUNTED.has(error.code) && <p className="text-xs text-muted-foreground">{t(W.notCounted).join(" · ")}</p>}
              {counter}
              {error.code !== "limit" && error.code !== "unavailable" && (
                <Big
                  onClick={() => {
                    if (error.back === "preview" && photo && fabric) void generate(photo.blob, fabric);
                    else setStep(error.back);
                  }}
                  testid="retry"
                >
                  <RefreshCw className="size-5" /> <Label w={t(W.retry)} lang={lang} />
                </Big>
              )}
              {error.code === "camera" && <GalleryButton lang={lang} t={t} onPhoto={(b) => (setPhoto({ blob: b, url: URL.createObjectURL(b) }), setStep("preview"))} onBad={() => fail("bad_photo", "camera")} />}
              {result && error.code === "limit" && <BackLink onClick={() => setStep("result")} w={t(W.back)} />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ───────────────────────── Steps ───────────────────────── */

function FabricStep({
  fabrics,
  err,
  lang,
  t,
  onRetry,
  onBack,
  onPick,
}: {
  fabrics: Fabric[] | null;
  err: string | null;
  lang: "ml" | "en";
  t: (w: readonly [string, string]) => [string, string];
  onRetry: () => void;
  onBack: () => void;
  onPick: (f: Fabric) => void;
}) {
  const [q, setQ] = React.useState("");
  const [family, setFamily] = React.useState<string | null>(null);
  const [pattern, setPattern] = React.useState<string | null>(null);
  const families = [...new Set((fabrics ?? []).map((f) => f.colourFamily).filter((x): x is string => !!x))].sort();
  const patterns = [...new Set((fabrics ?? []).map((f) => f.pattern).filter((x): x is string => !!x))].sort();
  const shown = (fabrics ?? []).filter((f) => {
    const s = q.trim().toLowerCase();
    if (s && ![f.name, f.code, f.colour, f.colourFamily].some((x) => x?.toLowerCase().includes(s))) return false;
    if (family && f.colourFamily !== family) return false;
    if (pattern && f.pattern !== pattern) return false;
    return true;
  });
  return (
    <div className="grid gap-3">
      <Title w={t(W.fabric)} lang={lang} />
      {err ? (
        <div className="grid gap-3 py-6 text-center" data-testid="tryon-error">
          <p className={cn("text-lg font-medium", lang === "ml" && "font-ml")}>{t(errOf(err))[0]}</p>
          <p className="text-sm text-muted-foreground">{t(errOf(err))[1]}</p>
          {err !== "no_fabrics" && (
            <Big onClick={onRetry}>
              <RefreshCw className="size-5" /> <Label w={t(W.retry)} lang={lang} />
            </Big>
          )}
        </div>
      ) : !fabrics ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <label className="flex h-12 items-center gap-2 rounded-xl border bg-card px-3">
            <Search className="size-5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(W.search).join(" · ")} className="h-full flex-1 bg-transparent text-base outline-none" aria-label="Search fabrics" />
          </label>
          {(families.length > 1 || patterns.length > 1) && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
              <Chip on={!family && !pattern} onClick={() => (setFamily(null), setPattern(null))}>
                {t(W.all)[0]}
              </Chip>
              {families.map((f) => (
                <Chip key={f} on={family === f} onClick={() => setFamily(family === f ? null : f)}>
                  {f}
                </Chip>
              ))}
              {patterns.map((p) => (
                <Chip key={p} on={pattern === p} onClick={() => setPattern(pattern === p ? null : p)}>
                  {p}
                </Chip>
              ))}
            </div>
          )}
          {shown.length === 0 && <p className="py-8 text-center text-muted-foreground">{t(W.noMatch).join(" · ")}</p>}
          <div className="grid grid-cols-2 gap-3" data-testid="fabric-grid">
            {shown.map((f) => (
              <button key={f.id} type="button" onClick={() => onPick(f)} className="overflow-hidden rounded-2xl border bg-card text-left shadow-xs active:scale-[.98]" data-testid="fabric-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.thumb} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                <div className="grid gap-0.5 p-2">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {f.hex && <span className="inline-block size-3 shrink-0 rounded-full border" style={{ background: f.hex }} />}
                    <span className="truncate">
                      {f.code}
                      {f.colour ? ` · ${f.colour}` : ""}
                    </span>
                  </p>
                  {f.rate > 0 && (
                    <p className="text-sm font-semibold tabular-nums">
                      ₹{f.rate} <span className="text-xs font-normal text-muted-foreground">{t(W.perMetre)[0]}</span>
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      <BackLink onClick={onBack} w={t(W.back)} />
    </div>
  );
}

const CAM_KEY = "suxus_tryon_camera";
type Facing = "user" | "environment";
const savedFacing = (): Facing => {
  try {
    return localStorage.getItem(CAM_KEY) === "environment" ? "environment" : "user";
  } catch {
    return "user";
  }
};

function CameraStep({
  lang,
  t,
  onPhoto,
  onDenied,
  onBadFile,
  onBack,
}: {
  lang: "ml" | "en";
  t: (w: readonly [string, string]) => [string, string];
  onPhoto: (b: Blob) => void;
  onDenied: () => void;
  onBadFile: () => void;
  onBack: () => void;
}) {
  const video = React.useRef<HTMLVideoElement>(null);
  const [ready, setReady] = React.useState(false);
  // Front (selfie) by default; the last choice on this phone is remembered
  const [facing, setFacing] = React.useState<Facing>("user");
  React.useEffect(() => setFacing(savedFacing()), []);
  /** bumped when the phone is turned: the stream is opened again so its frames follow the new orientation */
  const [turns, setTurns] = React.useState(0);
  const denied = React.useRef(onDenied);
  denied.current = onDenied;

  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const turned = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => setTurns((n) => n + 1), 350);
    };
    const so = typeof screen !== "undefined" ? screen.orientation : undefined;
    so?.addEventListener?.("change", turned);
    window.addEventListener("orientationchange", turned);
    return () => {
      if (t) clearTimeout(t);
      so?.removeEventListener?.("change", turned);
      window.removeEventListener("orientationchange", turned);
    };
  }, []);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let live = true;
    setReady(false);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        const portrait = typeof window !== "undefined" && window.innerHeight >= window.innerWidth;
        const want = (f: Facing): MediaStreamConstraints => ({
          // ask for a frame shaped like the screen; the browser hands back frames upright for the current orientation
          video: { facingMode: { ideal: f }, width: { ideal: portrait ? 1440 : 1920 }, height: { ideal: portrait ? 1920 : 1440 } },
          audio: false,
        });
        stream = await navigator.mediaDevices.getUserMedia(want(facing)).catch(async (e) => {
          // a phone without a back camera (or a laptop): any camera rather than none
          if ((e as Error).name === "OverconstrainedError" || (e as Error).name === "NotFoundError") return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          throw e;
        });
        if (!live) return stream.getTracks().forEach((tr) => tr.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
          setReady(true);
        }
      } catch {
        if (live) denied.current();
      }
    })();
    return () => {
      live = false;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [facing, turns]);

  const flip = () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    try {
      localStorage.setItem(CAM_KEY, next);
    } catch {
      /* not remembered — still switches */
    }
    setFacing(next);
  };

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    // Exactly what the preview box shows: the centre 3:4 portrait crop of the (upright) frame, at most 1280 px tall.
    // Drawn as the camera sees it — never mirrored, even though the selfie preview is shown like a mirror.
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const cw = Math.min(vw, (vh * 3) / 4);
    const ch = (cw * 4) / 3;
    const scale = Math.min(1, 1280 / ch);
    const c = document.createElement("canvas");
    c.width = Math.round(cw * scale);
    c.height = Math.round(ch * scale);
    c.getContext("2d")!.drawImage(v, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, c.width, c.height);
    c.toBlob((b) => b && onPhoto(b), "image/jpeg", 0.9);
  };

  const front = facing === "user";
  return (
    <div className="grid gap-3 landscape:grid-cols-[auto_1fr] landscape:items-center">
      {/* portrait: full width · landscape: as tall as the screen allows, buttons beside it */}
      <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black landscape:h-[calc(100dvh-7rem)] landscape:w-auto">
        <video ref={video} playsInline muted autoPlay className={cn("absolute inset-0 size-full object-cover", front && "-scale-x-100")} data-testid="camera-video" data-facing={facing} />
        {/* where to stand: head and shoulders */}
        <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          <ellipse cx="150" cy="140" rx="62" ry="80" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="3" strokeDasharray="10 8" />
          <path d="M40 400 C 45 300, 95 262, 150 258 C 205 262, 255 300, 260 400" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="3" strokeDasharray="10 8" />
        </svg>
        {!ready && (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="size-8 animate-spin text-white/70" />
          </div>
        )}
        {/* Front / back camera: large, top corner — well away from the capture button */}
        <button
          type="button"
          onClick={flip}
          aria-label={front ? "Use the back camera" : "Use the front camera"}
          data-testid="camera-switch"
          className="absolute top-3 right-3 flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-black/55 py-2 pr-4 pl-3 text-white shadow-lg backdrop-blur active:scale-95 landscape:top-2 landscape:right-2 landscape:px-3"
        >
          <SwitchCamera className="size-7" />
          <span className="flex flex-col text-left leading-tight landscape:hidden">
            <span className={cn("text-sm font-semibold", lang === "ml" && "font-ml")}>{t(front ? W.toBack : W.toFront)[0]}</span>
            <span className={cn("text-[10px] opacity-80", lang === "en" && "font-ml")}>{t(front ? W.toBack : W.toFront)[1]}</span>
          </span>
        </button>
        <p className={cn("absolute inset-x-0 bottom-2 px-3 text-center text-sm text-white drop-shadow landscape:text-[11px]", lang === "ml" && "font-ml")}>{t(W.standHint)[0]}</p>
      </div>
      <div className="grid gap-3">
        <Big onClick={capture} disabled={!ready} testid="capture">
          <Camera className="size-5" /> <Label w={t(W.capture)} lang={lang} />
        </Big>
        <GalleryButton lang={lang} t={t} onPhoto={onPhoto} onBad={onBadFile} />
        <BackLink onClick={onBack} w={t(W.back)} />
      </div>
    </div>
  );
}

function GalleryButton({ lang, t, onPhoto, onBad }: { lang: "ml" | "en"; t: (w: readonly [string, string]) => [string, string]; onPhoto: (b: Blob) => void; onBad: () => void }) {
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="gallery-input"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const b = await shrink(f).catch(() => null);
          if (b) onPhoto(b);
          else onBad();
        }}
      />
      <Big variant="outline" onClick={() => input.current?.click()}>
        <ImageIcon className="size-5" /> <Label w={t(W.gallery)} lang={lang} />
      </Big>
    </>
  );
}

function Generating({ lang, t, photo }: { lang: "ml" | "en"; t: (w: readonly [string, string]) => [string, string]; photo?: string }) {
  const [s, setS] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center" data-testid="generating">
      {photo && (
        <div className="relative w-2/3 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="aspect-[3/4] w-full object-cover opacity-60 blur-[2px]" />
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="size-12 animate-spin text-primary" />
          </div>
        </div>
      )}
      <Title w={t(W.generating)} lang={lang} />
      <p className={cn("text-base", lang === "ml" && "font-ml")}>{t(W.generatingNote)[0]}</p>
      <p className="text-sm text-muted-foreground">{t(W.generatingNote)[1]}</p>
      <p className="text-2xl font-semibold tabular-nums text-muted-foreground">{s} s</p>
    </div>
  );
}

/* ───────────────────────── Pieces ───────────────────────── */

function Title({ w, lang, big }: { w: [string, string]; lang: "ml" | "en"; big?: boolean }) {
  return (
    <div>
      <h1 className={cn("leading-tight font-semibold", big ? "text-2xl" : "text-xl", lang === "ml" ? "font-ml" : "font-display")}>{w[0]}</h1>
      <p className={cn("text-sm text-muted-foreground", lang === "en" && "font-ml")}>{w[1]}</p>
    </div>
  );
}
function Label({ w, lang, small }: { w: [string, string]; lang: "ml" | "en"; small?: boolean }) {
  return (
    <span className="flex flex-col items-center leading-tight">
      <span className={cn(small ? "text-sm" : "text-base", "font-semibold", lang === "ml" && "font-ml")}>{w[0]}</span>
      <span className={cn("text-[11px] font-normal opacity-75", lang === "en" && "font-ml")}>{w[1]}</span>
    </span>
  );
}
function Big({ children, onClick, variant = "primary", disabled, testid }: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "outline" | "gold"; disabled?: boolean; testid?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className={cn(
        "flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2 shadow-xs transition-all active:scale-[.98] disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "gold" && "bg-gold text-gold-foreground",
        variant === "outline" && "border bg-card",
      )}
    >
      {children}
    </button>
  );
}
function BackLink({ onClick, w }: { onClick: () => void; w: [string, string] }) {
  return (
    <button type="button" onClick={onClick} className="mx-auto mt-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
      <ArrowLeft className="size-4" /> {w.join(" · ")}
    </button>
  );
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap", on ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
      {children}
    </button>
  );
}
function FabricChip({ f, variant, lang }: { f: Fabric; variant: string | null; lang: "ml" | "en" }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={f.thumb} alt="" className="size-12 rounded-lg object-cover" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{f.name}</p>
        <p className="text-xs text-muted-foreground">
          {f.code}
          {variant ? ` · ${lang === "ml" ? (VARIANT_ML[variant.toLowerCase()] ?? variant) : variant}` : ""}
          {f.rate > 0 ? ` · ₹${f.rate}/m` : ""}
        </p>
      </div>
    </div>
  );
}
function SleeveIcon({ half }: { half: boolean }) {
  return (
    <svg viewBox="0 0 100 80" className="h-16 w-20 text-primary" aria-hidden>
      <path
        d={half ? "M35 8 L50 16 L65 8 L82 16 L92 34 L80 40 L74 32 L74 74 L26 74 L26 32 L20 40 L8 34 L18 16 Z" : "M35 8 L50 16 L65 8 L80 14 L96 64 L86 68 L74 34 L74 74 L26 74 L26 34 L14 68 L4 64 L20 14 Z"}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-[#25D366]" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.5 3.9 1.7.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.2Z"
      />
    </svg>
  );
}

/* ───────────────────────── Image helpers ───────────────────────── */

/**
 * A gallery photo: upright, at most 1280 px, JPEG (keeps uploads small on a slow network). Decoded through an <img>,
 * which every current browser (iPhone Safari included) draws with the photo's rotation flag applied — createImageBitmap
 * on Safari can ignore it and give a sideways picture. The JPEG written out has no rotation flag left to misread.
 */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.decoding = "async";
      i.style.imageOrientation = "from-image";
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("decode"));
      i.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error("decode");
    const scale = Math.min(1, 1280 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imageFile(url: string, code: string) {
  const r = await fetch(url);
  const b = await r.blob();
  return new File([b], `SUXUS-tryon-${code}.jpg`, { type: "image/jpeg" });
}
async function saveImage(url: string, code: string) {
  const f = await imageFile(url, code);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(f);
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
/** The image itself goes with the share (no link to it exists — nobody else can open it). */
async function shareImage(url: string, fabric: Fabric, phone: string) {
  const text = `SUXUS Heritage Tailor — ${fabric.name} (${fabric.code}). ${phone}`;
  const f = await imageFile(url, fabric.code).catch(() => null);
  if (f && navigator.canShare?.({ files: [f] })) {
    try {
      await navigator.share({ files: [f], text });
      return;
    } catch {
      /* cancelled */
      return;
    }
  }
  // No file sharing (desktop / older phone): save the picture, then open WhatsApp with the text
  if (f) await saveImage(url, fabric.code);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}
