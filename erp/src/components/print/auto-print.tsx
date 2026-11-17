"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";

/** Opens the print dialog once the page has rendered; shows a small toolbar on screen. */
export function AutoPrint({ auto = true, paper = "80mm" }: { auto?: boolean; paper?: "80mm" | "A4" | "label" }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [auto]);
  const size = paper === "A4" ? "A4" : paper === "label" ? "60mm 40mm" : "80mm auto";
  return (
    <>
      <style>{`@media print { @page { size: ${size}; margin: ${paper === "A4" ? "12mm" : "0"}; } }`}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-center gap-2 border-b bg-white/90 p-3 backdrop-blur">
        <button onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#153D33] px-4 text-sm font-medium text-white">
          <Printer className="size-4" /> Print
        </button>
        <button onClick={() => window.close()} className="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm">
          <X className="size-4" /> Close
        </button>
      </div>
    </>
  );
}
