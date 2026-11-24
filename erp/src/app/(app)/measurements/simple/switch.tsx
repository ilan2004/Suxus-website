"use client";

import { useRouter } from "next/navigation";
import { Ruler } from "lucide-react";
import { setSimpleMode } from "@/lib/actions/profile";

/** Detailed view: a link to the simple mode (big keypad, one field at a time) — or back to it. */
export function SimpleSwitch({ simple }: { simple: boolean }) {
  const router = useRouter();
  return (
    <div className="mb-2 flex justify-end">
      <button
        type="button"
        onClick={async () => {
          if (simple) return router.push("/measurements");
          await setSimpleMode(true);
          router.refresh();
        }}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
      >
        <Ruler className="size-3.5" /> {simple ? "Back to simple mode" : "Switch to simple mode"} <span className="ml">ലളിതമായ അളവ് രീതി</span>
      </button>
    </div>
  );
}
