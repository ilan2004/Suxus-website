"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: "CODE128", height: 28, width: 1.3, displayValue: false, margin: 0 });
  }, [value]);
  return <svg ref={ref} className="my-[0.5mm] h-[9mm] max-w-full" />;
}
