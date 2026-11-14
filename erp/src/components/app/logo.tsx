/* eslint-disable @next/next/no-img-element */
/** SUXUS logo from the official logo pack (public/brand). Never re-coloured or stretched. */
export function Logo({ className = "", variant = "topbar-dark", showErp = true }: { className?: string; variant?: "topbar-dark" | "topbar-light"; showErp?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={`/brand/logo-${variant}.svg`} alt="SUXUS" width={150} height={50} className="h-[58px] w-auto" />
      {showErp && <span className="rounded border border-current/25 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] opacity-70">ERP</span>}
    </div>
  );
}

/** Stacked logo with "HERITAGE TAILOR", for login / setup screens. */
export function LoginLogo({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return <img src={`/brand/logo-login-${dark ? "dark" : "light"}.svg`} alt="SUXUS Heritage Tailor" width={240} height={180} className={className} />;
}
