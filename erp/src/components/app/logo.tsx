export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid size-9 place-items-center rounded-lg bg-gold font-display text-lg font-bold text-[#153D33]">S</span>
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-semibold tracking-[0.18em]">SUXUS</span>
        <span className="block text-[10px] tracking-[0.2em] opacity-70">HERITAGE TAILOR · ERP</span>
      </span>
    </div>
  );
}
