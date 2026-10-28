"use client";

import { C, Dot, Illo, P, Stitch } from "./Draw";

/* SUXUS illustration set — single-weight line drawings on a 120 × 120 grid.
   Colour comes from `currentColor`; each one draws itself in on scroll. */

export function Shirt({ label = "Shirt" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M44 22 C52 30 68 30 76 22 L92 28 L108 46 L98 60 L88 52 L88 102 L32 102 L32 52 L22 60 L12 46 L28 28 Z" />
      <P i={2} d="M44 22 L54 40 L60 33 L66 40 L76 22" />
      <Stitch i={3} d="M60 33 V100" dash="3 4" />
      <P i={4} d="M68 54 h12 v12 l-6 3 l-6 -3 Z" />
      <Dot i={5} cx={60} cy={52} r={2.2} />
      <Dot i={6} cx={60} cy={68} r={2.2} />
      <Dot i={7} cx={60} cy={84} r={2.2} />
    </Illo>
  );
}

export function Trousers({ label = "Trousers" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M36 14 H84 L94 106 H68 L60 44 L52 106 H26 Z" />
      <P i={2} d="M36 24 H84" />
      <Stitch i={3} d="M60 24 V44" dash="3 4" />
      <P i={4} d="M44 24 C46 34 42 40 38 42 M76 24 C74 34 78 40 82 42" />
      <Dot i={5} cx={60} cy={19} r={2} />
    </Illo>
  );
}

export function Hanger({ label = "Sample garment on a hanger" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M60 34 C60 26 70 26 70 18 C70 11 61 9 57 14" />
      <P i={1} d="M60 34 L14 58 H106 Z" />
      <P i={2} d="M92 58 L98 72" />
      <P i={3} d="M88 72 h20 v26 h-20 Z" />
      <C i={4} cx={98} cy={78} r={2} />
      <Stitch i={4} d="M91 88 H105" dash="2 3" />
    </Illo>
  );
}

export function FabricBolt({ label = "Roll of fabric" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M30 32 A10 18 0 0 0 30 68 A10 18 0 0 0 30 32 Z" />
      <P i={1} d="M30 32 H92 A10 18 0 0 1 92 68 H30" />
      <C i={2} cx={30} cy={50} r={4} />
      <P i={3} d="M92 68 L100 104 H40 L36 68" />
      <Stitch i={4} d="M44 96 H94" dash="4 4" />
    </Illo>
  );
}

export function Scissors({ label = "Tailor's scissors" }) {
  return (
    <Illo label={label}>
      <C i={0} cx={30} cy={88} r={11} />
      <C i={1} cx={52} cy={100} r={11} />
      <P i={2} d="M38 80 L104 28" />
      <P i={3} d="M58 90 L96 20" />
      <Dot i={4} cx={63} cy={61} r={2.4} />
      <Stitch i={5} d="M14 40 H56" dash="4 4" />
    </Illo>
  );
}

export function NeedleThread({ label = "Needle and thread" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M22 102 L90 34" />
      <P i={1} d="M84 36 A4 7 45 1 1 92 28" />
      <P i={2} d="M90 30 C112 10 114 62 82 66 S36 74 28 52" />
    </Illo>
  );
}

export function Spool({ label = "Spool of thread" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M36 22 H84 M36 98 H84" />
      <P i={1} d="M44 22 V98 M76 22 V98" />
      <P i={2} d="M44 38 L76 44 M44 50 L76 56 M44 62 L76 68 M44 74 L76 80" />
      <P i={3} d="M76 84 C92 90 98 104 110 100" />
    </Illo>
  );
}

export function ChatBubble({ label = "WhatsApp enquiry" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M18 26 H102 V80 H52 L32 98 V80 H18 Z" />
      <Dot i={2} cx={44} cy={53} r={3.2} />
      <Dot i={3} cx={60} cy={53} r={3.2} />
      <Dot i={4} cx={76} cy={53} r={3.2} />
    </Illo>
  );
}

export function Parcel({ label = "Delivered uniforms" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M20 52 L60 36 L100 52 V94 L60 110 L20 94 Z" />
      <P i={1} d="M20 52 L60 68 L100 52 M60 68 V110" />
      <Stitch i={2} d="M40 44 L80 60" dash="3 3" />
      <P i={3} d="M74 18 L84 28 L104 8" />
    </Illo>
  );
}

export function Coat({ label = "Doctor's coat" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M46 14 L60 30 L74 14 L94 22 L104 104 H84 L80 56 L80 106 H40 L40 56 L36 104 H16 L26 22 Z" />
      <P i={1} d="M46 14 L52 46 L60 30 L68 46 L74 14" />
      <Stitch i={2} d="M60 30 V104" dash="3 4" />
      <P i={3} d="M46 76 h12 M66 76 h12" />
      <Dot i={4} cx={64} cy={58} r={2} />
      <Dot i={5} cx={64} cy={72} r={2} />
    </Illo>
  );
}

export function Waistcoat({ label = "Hotel waistcoat and bow tie" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M42 18 L60 52 L78 18 L96 30 L96 92 L60 106 L24 92 L24 30 Z" />
      <P i={1} d="M52 14 L60 20 L68 14 L68 26 L60 20 L52 26 Z" />
      <Stitch i={2} d="M60 52 V104" dash="3 4" />
      <Dot i={3} cx={66} cy={64} r={2} />
      <Dot i={4} cx={66} cy={78} r={2} />
      <Dot i={5} cx={66} cy={92} r={2} />
    </Illo>
  );
}

export function TieShirt({ label = "Office shirt and tie" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M44 22 C52 30 68 30 76 22 L92 28 L108 46 L98 60 L88 52 L88 102 L32 102 L32 52 L22 60 L12 46 L28 28 Z" />
      <P i={1} d="M44 22 L54 40 L60 33 L66 40 L76 22" />
      <P i={2} d="M57 33 H63 L66 40 L62 84 L60 88 L58 84 L54 40 Z" />
    </Illo>
  );
}

export function Cap({ label = "Graduation cap" }) {
  return (
    <Illo label={label}>
      <P i={0} d="M10 46 L60 26 L110 46 L60 66 Z" />
      <P i={1} d="M30 54 V80 C44 92 76 92 90 80 V54" />
      <P i={2} d="M100 50 V78" />
      <Dot i={3} cx={100} cy={82} r={3} />
      <Stitch i={4} d="M34 80 C48 88 72 88 86 80" dash="3 3" />
    </Illo>
  );
}
