"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, { format: "CODE128", height: 60, width: 2, displayValue: false, margin: 0 });
    // Scale by CSS (11 mm tall, never wider than the label) instead of the pixel size JsBarcode sets
    const w = ref.current.getAttribute("width");
    const h = ref.current.getAttribute("height");
    if (w && h) {
      ref.current.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
      ref.current.removeAttribute("width");
      ref.current.removeAttribute("height");
      ref.current.setAttribute("preserveAspectRatio", "none");
    }
  }, [value]);
  return <svg ref={ref} />;
}
