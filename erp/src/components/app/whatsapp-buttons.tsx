"use client";

import * as React from "react";
import { ChevronDown, Images, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { shareToWhatsApp } from "@/lib/whatsapp-share";
import { waLink } from "@/lib/utils";

export type WaMessage = { label: string; text: string; photos?: string[] };

/** WhatsApp button: sends the main message with fabric photos (share sheet) or text-only to the customer's chat. */
export function WhatsAppButtons({ phone, messages, name }: { phone?: string | null; messages: WaMessage[]; name: string }) {
  const [busy, setBusy] = React.useState(false);
  const main = messages[0];
  const withPhotos = async (m: WaMessage) => {
    setBusy(true);
    try {
      const r = await shareToWhatsApp({ text: m.text, phone, photos: m.photos, name });
      if (r === "shared") toast.success("Message copied too — paste it in WhatsApp if it didn't come with the photos");
    } finally {
      setBusy(false);
    }
  };
  const textOnly = (m: WaMessage) => {
    const url = waLink(phone, m.text) ?? `https://wa.me/?text=${encodeURIComponent(m.text)}`;
    window.open(url, "_blank");
  };
  const photoCount = main.photos?.length ?? 0;

  return (
    <div className="inline-flex">
      <Button variant="outline" className="rounded-r-none" disabled={busy} onClick={() => (photoCount ? withPhotos(main) : textOnly(main))}>
        {busy ? <Loader2 className="animate-spin" /> : photoCount ? <Images className="text-success" /> : <MessageCircle className="text-success" />}
        WhatsApp{photoCount ? ` + ${photoCount} photo${photoCount > 1 ? "s" : ""}` : ""}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-l-none border-l-0" aria-label="More WhatsApp options">
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {messages.map((m, i) => (
            <React.Fragment key={m.label}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{m.label}</DropdownMenuLabel>
              {!!m.photos?.length && (
                <DropdownMenuItem onSelect={() => void withPhotos(m)}>
                  <Images /> With {m.photos.length} fabric photo{m.photos.length > 1 ? "s" : ""}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => textOnly(m)} disabled={!phone}>
                <MessageCircle /> Text only{phone ? ` to ${phone}` : " (no phone saved)"}
              </DropdownMenuItem>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
