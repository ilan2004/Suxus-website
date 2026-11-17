export default function PrintLayout({ children }: { children: React.ReactNode }) {
  // print:min-h-0 — a full-screen min-height here would spill onto an extra (blank) printed page
  return <div className="print-shell min-h-dvh bg-neutral-200 print:min-h-0 print:bg-white [color-scheme:light]">{children}</div>;
}
