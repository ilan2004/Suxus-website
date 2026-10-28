import Link from "next/link";

/* Embroidered S monogram: gold S inside a stitched ring.
   Swap for the real logo SVG when available (public/images/logo.svg). */
export function Monogram() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#153D33" stroke="#C8A96A" strokeWidth="1" />
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="#C8A96A" strokeWidth="1" strokeDasharray="2.4 2.4" />
      <text
        x="24"
        y="32"
        textAnchor="middle"
        style={{ fontFamily: "var(--f-display)" }}
        fontSize="23"
        fontWeight="600"
        fill="#C8A96A"
      >
        S
      </text>
    </svg>
  );
}

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="SUXUS Heritage Tailor — home">
      <Monogram />
      <span>
        <span className="brand-name">SUXUS</span>
        <span className="brand-tag">Heritage Tailor</span>
      </span>
    </Link>
  );
}
