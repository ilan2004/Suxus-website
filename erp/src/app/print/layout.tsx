export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-neutral-200 print:bg-white [color-scheme:light]">{children}</div>;
}
