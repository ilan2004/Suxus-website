"use client";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** A modal sheet/dialog sets pointer-events:none on <body>; keep toasts (and their Undo buttons) tappable. */
export function Toaster(props: ToasterProps) {
  return <Sonner richColors closeButton position="top-center" className="toaster group" style={{ pointerEvents: "auto" }} {...props} />;
}

/** Tapping a toast must not count as "clicking outside" an open sheet or dialog (which would close it). */
export function isToastEvent(e: Event) {
  return e.target instanceof Element && !!e.target.closest("[data-sonner-toaster]");
}
