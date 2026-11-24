"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Share2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shareJobSlip } from "@/lib/actions/job-slip";
import { cn } from "@/lib/utils";

export type SlipLink = { url: string; fileName: string };

/**
 * Print bundle label · View PDF · Share — on each order item (itemId), or for the whole order's job slips (no itemId:
 * View and Share only). Share sends the PDF itself through the phone's share sheet (WhatsApp).
 */
export function JobSlipActions({ orderId, itemId, link, className }: { orderId: number; itemId?: number; link: SlipLink; className?: string }) {
  const router = useRouter();
  const [sharing, setSharing] = React.useState(false);
  // Started on touch-down so the file is ready by the time the tap finishes (the share sheet must open within the tap)
  const prepared = React.useRef<Promise<{ file: File | null; text: string; abs: string } | null> | null>(null);
  const prepare = () => {
    if (prepared.current) return prepared.current;
    prepared.current = (async () => {
      const r = await shareJobSlip(orderId, itemId ?? null);
      if (!r.ok) {
        toast.error(r.error);
        return null;
      }
      const abs = new URL(r.data.url, window.location.origin).toString();
      try {
        const blob = await (await fetch(`${abs}?s=1`)).blob();
        return { file: new File([blob], r.data.fileName, { type: "application/pdf" }), text: r.data.text, abs };
      } catch {
        return { file: null, text: r.data.text, abs };
      }
    })();
    return prepared.current;
  };

  const share = async () => {
    setSharing(true);
    try {
      const p = await prepare();
      prepared.current = null;
      if (!p) return;
      if (p.file && navigator.canShare?.({ files: [p.file] })) {
        await navigator.share({ files: [p.file], title: p.file.name, text: p.text });
      } else if (navigator.share) {
        await navigator.share({ title: p.text, text: p.text, url: p.abs });
      } else {
        // Computer: WhatsApp Web with the private link
        window.open(`https://wa.me/?text=${encodeURIComponent(`${p.text}\n${p.abs}`)}`, "_blank");
      }
      router.refresh();
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Could not share — try again");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {itemId && (
        <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => (window.open(`/print/bundle-label/${itemId}`, "_blank"), setTimeout(() => router.refresh(), 1500))}>
          <Tag /> Print bundle label <span className="ml">ലേബൽ പ്രിന്റ്</span>
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" className="h-10" asChild>
        <a href={link.url} target="_blank" rel="noopener" onClick={() => setTimeout(() => router.refresh(), 1500)}>
          <FileText /> View PDF <span className="ml">PDF കാണുക</span>
        </a>
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-10" onPointerDown={() => void prepare()} onClick={share} disabled={sharing}>
        {sharing ? <Loader2 className="animate-spin" /> : <Share2 className="text-success" />} Share <span className="ml">അയക്കുക</span>
      </Button>
    </div>
  );
}
