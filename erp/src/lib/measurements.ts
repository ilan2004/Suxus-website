/**
 * Measurement fields per garment type (inches) — from the "Measurements" sheet.
 * key = the name stored in the record's values; en = the label shown.
 * One "Shirt" covers full and half sleeve: everything is entered once, with a separate length for each sleeve.
 */
export type GarmentField = { key: string; en: string; ml: string };
export const GARMENTS: Record<string, GarmentField[]> = {
  Shirt: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Shoulder:തോൾ", "Sleeve full=Sleeve — full:ഫുൾ കൈ നീളം", "Sleeve half=Sleeve — half:ഹാഫ് കൈ നീളം", "Neck:കഴുത്ത്", "Cuff:കഫ്"),
  "Pant / Trouser": f("Length:നീളം", "Waist:അര", "Seat:സീറ്റ്", "Thigh:തുട", "Knee:മുട്ട്", "Bottom:ബോട്ടം"),
  "School Uniform Trouser": f("Length:നീളം", "Waist:അര", "Seat:സീറ്റ്", "Thigh:തുട", "Knee:മുട്ട്", "Bottom:ബോട്ടം"),
  "Churidar Top": f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Hip:ഇടുപ്പ്", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Armhole:കൈക്കുഴി", "Neck-F:കഴുത്ത് മുൻ", "Neck-B:കഴുത്ത് പിൻ"),
  "Churidar Bottom": f("Waist:അര", "Hip:ഇടുപ്പ്", "Length:നീളം", "Thigh:തുട", "Ankle:കണങ്കാൽ"),
  Blouse: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Armhole:കൈക്കുഴി", "Neck-F:കഴുത്ത് മുൻ", "Neck-B:കഴുത്ത് പിൻ"),
  Frock: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Hip:ഇടുപ്പ്", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Neck:കഴുത്ത്"),
  Other: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Shoulder:തോൾ", "Sleeve:കൈ നീളം"),
};
export const GARMENT_TYPES = Object.keys(GARMENTS);

/** Old garment names (before the shirt merge) still read correctly if one turns up, e.g. from an old backup. */
export const LEGACY_GARMENTS: Record<string, { to: string; sleeve: string }> = {
  "Shirt Full Sleeve": { to: "Shirt", sleeve: "Sleeve full" },
  "Shirt Half Sleeve": { to: "Shirt", sleeve: "Sleeve half" },
};

/** "key=Label:Malayalam" or "Label:Malayalam" (key = label). */
function f(...defs: string[]): GarmentField[] {
  return defs.map((d) => {
    const [head, ml] = d.split(":");
    const [key, en] = head.includes("=") ? head.split("=") : [head, head];
    return { key, en, ml };
  });
}

/** Fields for a record's garment; unknown garments show whatever values they have. */
export function fieldsFor(garmentType: string, values: Record<string, unknown> = {}): GarmentField[] {
  return GARMENTS[garmentType] ?? Object.keys(values).map((k) => ({ key: k, en: k, ml: "" }));
}
