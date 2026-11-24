"use client";

import * as React from "react";
import { toast } from "sonner";
import { jobSlipByCode } from "@/lib/actions/job-slip";
import { parseItemCode } from "@/lib/job-slip-code";

/** A USB barcode scanner types the code fast (~30 ms a key) and presses Enter. People type far slower. */
const MAX_GAP_MS = 80;

/**
 * Anywhere in the app: scanning a bundle label (JOB-<item id>) with the USB scanner opens that item's job slip PDF.
 * Only fast, scanner-speed input is taken; if a text box had focus, the scanned code is taken back out of it.
 */
export function BundleScanListener() {
  React.useEffect(() => {
    let buf = "";
    let last = 0;
    let fastKeys = 0;
    const onKey = (e: KeyboardEvent) => {
      const now = performance.now();
      const gap = now - last;
      last = now;
      if (gap > MAX_GAP_MS) {
        buf = "";
        fastKeys = 0;
      }
      if (e.key === "Enter") {
        const code = buf;
        const fast = fastKeys >= code.length - 1;
        buf = "";
        fastKeys = 0;
        const itemId = parseItemCode(code);
        if (!itemId || !fast || code.length < 5) return;
        e.preventDefault();
        e.stopPropagation();
        // The code went into a focused text box as it was typed: take it back out
        const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
        if (el && "value" in el && typeof el.value === "string" && el.value.toUpperCase().endsWith(code.toUpperCase())) {
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
          setter?.call(el, el.value.slice(0, -code.length));
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const t = toast.loading(`Opening job slip ${code}…`);
        jobSlipByCode(code).then((r) => {
          toast.dismiss(t);
          if (!r.ok) return void toast.error(r.error);
          window.location.href = r.data.url;
        });
        return;
      }
      if (e.key.length === 1) {
        if (buf && gap <= MAX_GAP_MS) fastKeys++;
        buf = (buf + e.key).slice(-24);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  return null;
}
