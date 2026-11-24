"use client";

import * as React from "react";
import { ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/app/barcode-scanner";
import { jobSlipByCode } from "@/lib/actions/job-slip";

/** Phone camera: scan a bundle label → that item's job slip PDF. */
export function ScanBundleButton({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <ScanBarcode /> Scan bundle <span className="ml">ലേബൽ സ്കാൻ</span>
      </Button>
      <BarcodeScanner
        open={open}
        onClose={() => setOpen(false)}
        title="Scan the bundle label"
        onResult={async (code) => {
          setOpen(false);
          const r = await jobSlipByCode(code);
          if (!r.ok) return void toast.error(r.error);
          window.location.href = r.data.url;
        }}
      />
    </>
  );
}
