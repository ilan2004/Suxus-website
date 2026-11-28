/**
 * Orders from the shop website (suxus.shop/order): the customer measures a well-fitting shirt / pant of their own,
 * laid flat ("existing garment" method — never on the body), and we turn those figures into the ERP's measurement
 * fields, the same way the cutting master records them in the shop.
 *
 * The website keeps its own copy of these keys (lib/order.ts there): change both together.
 *
 *  Shirt (ERP "Shirt")
 *   chestQ        button-placket outer edge → underarm seam     → Chest (recorded as is; shirt round = ×4 + 2)
 *   waistQ        button-placket outer edge → side seam at waist → Waist (recorded as is; shirt round = ×4 + 2)
 *   lenShoulder   shoulder seam → bottom hem                      → Length
 *   lenCentre     button centre (top) → bottom hem                → remarks
 *   lenUnderarm   underarm seam → bottom hem                      → remarks
 *   shoulder      left → right shoulder seam (back view)         → Shoulder
 *   sleeveFull    shoulder seam → cuff edge   (full sleeve)       → Sleeve full
 *   cuffW         cuff buttoned, laid flat, edge to edge          → Cuff = ×2
 *   sleeveHalf    shoulder seam → sleeve hem  (half sleeve)       → Sleeve half
 *   halfEndW      half-sleeve hem, flat width                     → remarks (flat, not ×2)
 *   upperSleeveW  sleeve laid flat, width at the top (biceps)     → Sleeve armpit = ×2
 *   collar        collar button centre → buttonhole centre        → Neck
 *
 *  Pant (ERP "Pant / Trouser") — button and zip closed, laid flat
 *   length        top of waistband → hem, along the outer side    → Length
 *   waistW        waistband, edge to edge                          → Waist = ×2
 *   seatW         widest part of the seat, edge to edge           → Seat = ×2
 *   thighW        one leg just below the crotch, edge to edge     → Thigh = ×2
 *   kneeW         one leg at the knee, edge to edge               → Knee = ×2
 *   bottomW       hem of one leg, edge to edge                    → Bottom = ×2
 */

export const CM_PER_INCH = 2.54;
export type Unit = "in" | "cm";
export type SleeveType = "full" | "half";
export type PocketChoice = "none" | "one" | "two";
export type PantModel = "Regular" | "Loose";

export const SHIRT_KEYS = ["chestQ", "waistQ", "lenShoulder", "lenCentre", "lenUnderarm", "shoulder", "sleeveFull", "cuffW", "sleeveHalf", "halfEndW", "upperSleeveW", "collar"] as const;
export const PANT_KEYS = ["length", "waistW", "seatW", "thighW", "kneeW", "bottomW"] as const;
export type ShirtKey = (typeof SHIRT_KEYS)[number];
export type PantKey = (typeof PANT_KEYS)[number];

/** Which shirt figures the customer must give for a sleeve type (the other sleeve's fields are not asked). */
export function shirtKeysFor(sleeve: SleeveType): ShirtKey[] {
  const common: ShirtKey[] = ["chestQ", "waistQ", "lenShoulder", "lenCentre", "lenUnderarm", "shoulder", "upperSleeveW", "collar"];
  return sleeve === "full" ? [...common, "sleeveFull", "cuffW"] : [...common, "sleeveHalf", "halfEndW"];
}

/** Plausible range per figure, in inches (a typo such as 115 for 11.5 is caught). */
export const RANGE: Record<ShirtKey | PantKey, [number, number]> = {
  chestQ: [7, 20],
  waistQ: [7, 20],
  lenShoulder: [20, 40],
  lenCentre: [15, 36],
  lenUnderarm: [10, 30],
  shoulder: [12, 26],
  sleeveFull: [16, 30],
  cuffW: [3.5, 7],
  sleeveHalf: [5, 14],
  halfEndW: [4, 10],
  upperSleeveW: [4, 11],
  collar: [12, 22],
  length: [26, 48],
  waistW: [11, 28],
  seatW: [15, 32],
  thighW: [8, 18],
  kneeW: [6, 14],
  bottomW: [5, 12],
};

export type ShirtItem = { garment: "Shirt"; fabricCode: string; qty: number; sleeve: SleeveType; pocket: PocketChoice; m: Partial<Record<ShirtKey, number>> };
export type PantItem = { garment: "Pant"; fabricCode: string; qty: number; model: PantModel; m: Partial<Record<PantKey, number>> };
export type WebOrderItem = ShirtItem | PantItem;

const r2 = (n: number) => Math.round(n * 100) / 100;
/** A typed figure in inches (the ERP's unit). */
export const toInches = (v: number, unit: Unit) => r2(unit === "cm" ? v / CM_PER_INCH : v);

/** The ERP measurement record for one item: garment type, values (inches), fit, remarks and pocket. */
export function erpMeasurement(item: WebOrderItem, unit: Unit) {
  const inch = (v: number | undefined) => (v == null || !Number.isFinite(v) ? null : toInches(v, unit));
  const shown = (v: number | undefined) => (v == null ? "" : `${r2(v)} ${unit}`);
  if (item.garment === "Shirt") {
    const m = item.m;
    const x2 = (v: number | undefined) => (inch(v) == null ? null : r2(inch(v)! * 2));
    const values: Record<string, number | null> = {
      Chest: inch(m.chestQ),
      Waist: inch(m.waistQ),
      Length: inch(m.lenShoulder),
      Shoulder: inch(m.shoulder),
      "Sleeve armpit": x2(m.upperSleeveW),
      Neck: inch(m.collar),
      ...(item.sleeve === "full" ? { "Sleeve full": inch(m.sleeveFull), Cuff: x2(m.cuffW) } : { "Sleeve half": inch(m.sleeveHalf) }),
    };
    const notes = [
      `Website order — measured on the customer's own shirt (laid flat), ${item.sleeve === "full" ? "full" : "half"} sleeve`,
      m.lenCentre != null ? `Centre length (button centre → hem) ${shown(m.lenCentre)}` : "",
      m.lenUnderarm != null ? `Underarm length (underarm → hem) ${shown(m.lenUnderarm)}` : "",
      item.sleeve === "half" && m.halfEndW != null ? `Half-sleeve end width (flat) ${shown(m.halfEndW)}` : "",
    ].filter(Boolean);
    const pocket =
      item.pocket === "none"
        ? { count: "none" as const, size: null, width: null, depth: null, shape: null, flap: false }
        : item.pocket === "two"
          ? { count: "two" as const, size: null, width: null, depth: null, shape: null, flap: true, button: true }
          : { count: "one" as const, size: null, width: null, depth: null, shape: null, flap: false };
    return { garmentType: "Shirt", values, fit: null as string | null, remarks: notes.join(" · "), pocket };
  }
  const m = item.m;
  const x2 = (v: number | undefined) => (inch(v) == null ? null : r2(inch(v)! * 2));
  return {
    garmentType: "Pant / Trouser",
    values: { Length: inch(m.length), Waist: x2(m.waistW), Seat: x2(m.seatW), Thigh: x2(m.thighW), Knee: x2(m.kneeW), Bottom: x2(m.bottomW) } as Record<string, number | null>,
    fit: item.model as string | null,
    remarks: "Website order — measured on the customer's own pant (laid flat, button and zip closed)",
    pocket: null,
  };
}

/** What each website figure is (for the ERP's order page). */
export const FIGURE_LABEL: Record<ShirtKey | PantKey, string> = {
  chestQ: "Chest — placket edge to underarm seam",
  waistQ: "Waist — placket edge to side seam",
  lenShoulder: "Length — shoulder seam to hem",
  lenCentre: "Length — button centre to hem",
  lenUnderarm: "Length — underarm to hem",
  shoulder: "Shoulder — seam to seam (back)",
  sleeveFull: "Full sleeve — shoulder seam to cuff edge",
  cuffW: "Cuff — width, buttoned, flat",
  sleeveHalf: "Half sleeve — shoulder seam to hem",
  halfEndW: "Half sleeve end — width, flat",
  upperSleeveW: "Upper sleeve — width, flat",
  collar: "Collar — button centre to buttonhole centre",
  length: "Length — waistband top to hem",
  waistW: "Waist — waistband width, flat",
  seatW: "Seat — width, flat",
  thighW: "Thigh — width below crotch, flat",
  kneeW: "Knee — width, flat",
  bottomW: "Bottom — hem width, flat",
};
