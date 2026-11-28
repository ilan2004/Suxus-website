import type { Diagram } from "@/lib/order";

/* Measurement guide drawings: the customer's own garment laid flat, with one red arrow from Start to End and the
   measurement's gold number. Drawn in SVG so every guide shares one style; real photographs can replace them later. */

const INK = "#153D33";
const CLOTH = "#FBF8F1";
const RED = "#C62828";
const GOLD = "#C8A64A";

type A = { x1: number; y1: number; x2: number; y2: number };

/** Where each measurement's arrow runs (viewBox 0 0 300 340). */
const ARROWS: Record<string, A> = {
  chestQ: { x1: 156, y1: 118, x2: 213, y2: 118 },
  waistQ: { x1: 156, y1: 222, x2: 212, y2: 222 },
  lenShoulder: { x1: 229, y1: 50, x2: 207, y2: 304 },
  lenCentre: { x1: 150, y1: 58, x2: 150, y2: 318 },
  lenUnderarm: { x1: 215, y1: 116, x2: 213, y2: 300 },
  sleeveFull: { x1: 233, y1: 50, x2: 272, y2: 226 },
  cuffW: { x1: 249, y1: 218, x2: 272, y2: 210 },
  upperSleeveW: { x1: 244, y1: 86, x2: 217, y2: 104 },
  shoulder: { x1: 72, y1: 50, x2: 228, y2: 50 },
  sleeveHalf: { x1: 233, y1: 50, x2: 258, y2: 118 },
  halfEndW: { x1: 222, y1: 128, x2: 260, y2: 114 },
  collar: { x1: 70, y1: 150, x2: 230, y2: 150 },
  length: { x1: 76, y1: 22, x2: 56, y2: 336 },
  waistW: { x1: 92, y1: 30, x2: 208, y2: 30 },
  seatW: { x1: 87, y1: 84, x2: 213, y2: 84 },
  thighW: { x1: 84, y1: 132, x2: 147, y2: 132 },
  kneeW: { x1: 78, y1: 232, x2: 143, y2: 232 },
  bottomW: { x1: 72, y1: 330, x2: 137, y2: 330 },
};

function Base({ d }: { d: Diagram }) {
  const line = { fill: CLOTH, stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const };
  if (d === "pant")
    return (
      <g>
        <path d="M90 18 L210 18 L232 340 L160 340 L150 112 L140 340 L68 340 Z" {...line} />
        <path d="M90 18 L210 18 L211 36 L89 36 Z" fill="#EFE9DC" stroke={INK} strokeWidth="2" />
        <path d="M150 36 L150 98 M150 36 Q138 70 150 98" fill="none" stroke={INK} strokeWidth="1.3" strokeDasharray="4 3" />
        <circle cx="150" cy="27" r="3.5" fill={INK} />
        <path d="M100 18 L100 36 M200 18 L200 36" stroke={INK} strokeWidth="1.3" />
      </g>
    );
  if (d === "collar")
    return (
      <g>
        <path d="M40 140 Q150 112 260 140 L262 166 Q150 140 38 166 Z" {...line} />
        <circle cx="70" cy="150" r="5" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="70" cy="150" r="1" fill={INK} />
        <rect x="222" y="146" width="16" height="7" rx="3.5" fill="#fff" stroke={INK} strokeWidth="2" />
        <text x="150" y="205" textAnchor="middle" fontSize="11" fill={INK} opacity=".75">
          collar opened flat · കോളർ തുറന്ന് നിരപ്പായി
        </text>
      </g>
    );
  const half = d === "shirtHalf";
  const back = d === "shirtBack";
  const body = half
    ? "M125 28 L70 45 L42 118 L80 130 L86 112 L88 300 Q150 332 212 300 L214 112 L220 130 L258 118 L230 45 L175 28 Q150 40 125 28 Z"
    : "M125 28 L70 45 L28 226 L50 236 L86 112 L88 300 Q150 332 212 300 L214 112 L250 236 L272 226 L230 45 L175 28 Q150 40 125 28 Z";
  return (
    <g>
      <path d={body} {...line} />
      {!back && (
        <>
          <path d="M125 28 L136 54 L150 40 L164 54 L175 28" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M145 46 L145 318 M155 46 L155 318" stroke={INK} strokeWidth="1.3" />
          {[70, 110, 150, 190, 230, 270].map((y) => (
            <circle key={y} cx="150" cy={y} r="3" fill="#fff" stroke={INK} strokeWidth="1.5" />
          ))}
        </>
      )}
      {back && <path d="M125 28 Q150 22 175 28 M100 70 Q150 80 200 70" fill="none" stroke={INK} strokeWidth="1.3" strokeDasharray="4 3" />}
      {!half && (
        <path d="M32 210 L54 220 M246 220 L268 210" stroke={INK} strokeWidth="1.5" />
      )}
      <path d="M70 45 L86 112 M230 45 L214 112" stroke={INK} strokeWidth="1.2" strokeDasharray="4 3" />
      <text x="150" y="336" textAnchor="middle" fontSize="10" fill={INK} opacity=".7">
        {back ? "back view · പിൻഭാഗം" : "front, buttoned, laid flat · ബട്ടൺ ഇട്ട് നിരപ്പായി"}
      </text>
    </g>
  );
}

export function MeasureDiagram({ diagram, field, num }: { diagram: Diagram; field: string; num: number }) {
  const a = ARROWS[field];
  const ang = a ? Math.atan2(a.y2 - a.y1, a.x2 - a.x1) : 0;
  const head = (x: number, y: number, dir: number) => {
    const s = 9;
    return `M${x} ${y} L${x - s * Math.cos(dir - 0.45)} ${y - s * Math.sin(dir - 0.45)} M${x} ${y} L${x - s * Math.cos(dir + 0.45)} ${y - s * Math.sin(dir + 0.45)}`;
  };
  return (
    <svg viewBox="0 0 300 340" role="img" aria-label="Measurement guide" className="measure-svg">
      <Base d={diagram} />
      {a && (
        <g>
          <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={RED} strokeWidth="3" strokeLinecap="round" />
          <path d={head(a.x2, a.y2, ang) + head(a.x1, a.y1, ang + Math.PI)} stroke={RED} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx={a.x1} cy={a.y1} r="5" fill={RED} />
          <circle cx={a.x2} cy={a.y2} r="5" fill="#fff" stroke={RED} strokeWidth="2.5" />
          <g transform={`translate(${(a.x1 + a.x2) / 2 + 14 * Math.sin(ang)}, ${(a.y1 + a.y2) / 2 - 14 * Math.cos(ang)})`}>
            <circle r="12" fill={GOLD} />
            <text y="4.5" textAnchor="middle" fontSize="13" fontWeight="700" fill={INK}>
              {num}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}
