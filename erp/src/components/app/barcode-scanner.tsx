"use client";

import * as React from "react";
import { Flashlight, Keyboard, Loader2, ScanBarcode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called once per code read. Return false to keep scanning (e.g. "not found"). */
  onResult: (code: string) => boolean | void | Promise<boolean | void>;
  title?: string;
};

type Controls = { stop: () => void };

/**
 * Full-screen camera barcode scanner.
 * Uses the browser's built-in BarcodeDetector where available (Android Chrome), otherwise ZXing
 * (works on iPhone Safari). Reads the CODE128 labels printed by the ERP, EAN/UPC on supplier rolls and QR codes.
 */
export function BarcodeScanner({ open, onClose, onResult, title = "Scan barcode" }: Props) {
  const video = React.useRef<HTMLVideoElement>(null);
  const controls = React.useRef<Controls | null>(null);
  const busy = React.useRef(false);
  const lastCode = React.useRef<{ code: string; at: number } | null>(null);
  const [status, setStatus] = React.useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = React.useState<string | null>(null);
  const [torch, setTorch] = React.useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const [manual, setManual] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [flash, setFlash] = React.useState<string | null>(null);

  const handle = React.useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || busy.current) return;
      const now = Date.now();
      if (lastCode.current && lastCode.current.code === code && now - lastCode.current.at < 2500) return; // same label still in view
      lastCode.current = { code, at: now };
      busy.current = true;
      try {
        navigator.vibrate?.(60);
        setFlash(code);
        const keep = await onResult(code);
        if (keep === false) setTimeout(() => setFlash(null), 1200);
      } finally {
        busy.current = false;
      }
    },
    [onResult],
  );

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("starting");
    setError(null);
    setFlash(null);
    setManual(false);
    lastCode.current = null;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot open the camera. Type the code instead.");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const el = video.current!;
        el.srcObject = stream;
        el.setAttribute("playsinline", "true"); // iPhone: play inside the page, not full-screen
        await el.play();
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorch({ supported: !!caps.torch, on: false });
        const stopStream = () => stream.getTracks().forEach((t) => t.stop());

        type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (BD) {
          const detector = new BD({ formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "qr_code"] });
          let alive = true;
          const loop = async () => {
            if (!alive) return;
            try {
              if (el.readyState >= 2) {
                const found = await detector.detect(el);
                if (found[0]?.rawValue) await handle(found[0].rawValue);
              }
            } catch {
              /* frame not ready */
            }
            if (alive) setTimeout(loop, 120);
          };
          void loop();
          controls.current = { stop: () => ((alive = false), stopStream()) };
        } else {
          const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_39,
            BarcodeFormat.QR_CODE,
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
          const c = await reader.decodeFromVideoElement(el, (result) => {
            if (result) void handle(result.getText());
          });
          controls.current = { stop: () => (c.stop(), stopStream()) };
        }
        if (!cancelled) setStatus("scanning");
      } catch (e) {
        const err = e as Error & { name?: string };
        setStatus("error");
        setError(
          err.name === "NotAllowedError"
            ? "Camera permission was refused. Allow the camera for this site (iPhone: Settings → Safari → Camera → Allow), or type the code."
            : err.name === "NotFoundError"
              ? "No camera found on this device. Type the code instead."
              : err.message || "Could not start the camera.",
        );
        setManual(true);
      }
    })();

    return () => {
      cancelled = true;
      controls.current?.stop();
      controls.current = null;
    };
  }, [open, handle]);

  const toggleTorch = async () => {
    const stream = video.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white" role="dialog" aria-label={title}>
      <div className="flex items-center justify-between gap-3 p-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <ScanBarcode className="size-5" /> {title}
        </p>
        <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-white/10" aria-label="Close scanner">
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={video} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
        {/* aiming frame */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={cn("relative h-40 w-[82%] max-w-md rounded-2xl border-2 transition-colors", flash ? "border-green-400" : "border-white/80")}>
            <span className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500/80" />
          </div>
        </div>
        {status === "starting" && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-5 animate-spin" /> Opening camera…
            </span>
          </div>
        )}
        {flash && (
          <div className="absolute inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-green-500 px-4 py-2 font-mono text-sm font-semibold text-black shadow-lg">{flash}</div>
        )}
        {error && <div className="absolute inset-x-4 top-4 rounded-lg bg-red-600/90 p-3 text-sm">{error}</div>}
      </div>

      <div className="grid gap-3 p-4">
        {manual ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lastCode.current = null;
              void handle(typed);
              setTyped("");
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              placeholder="Type code / barcode"
              className="h-12 flex-1 rounded-xl bg-white px-4 font-mono text-base text-black outline-none"
            />
            <Button type="submit" size="lg" variant="gold" className="h-12">
              OK
            </Button>
          </form>
        ) : (
          <p className="text-center text-xs text-white/70">Hold the barcode inside the frame · keep the phone steady, 10–20 cm away</p>
        )}
        <div className="flex justify-center gap-3">
          {torch.supported && (
            <button type="button" onClick={toggleTorch} className={cn("inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm", torch.on ? "bg-yellow-300 text-black" : "bg-white/10")}>
              <Flashlight className="size-4" /> Light
            </button>
          )}
          <button type="button" onClick={() => setManual((m) => !m)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm">
            <Keyboard className="size-4" /> {manual ? "Hide keyboard" : "Type instead"}
          </button>
        </div>
      </div>
    </div>
  );
}
