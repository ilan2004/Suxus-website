/** Measurement fields per garment type (inches) — from the "Measurements" sheet. */
export const GARMENTS: Record<string, { en: string; ml: string }[]> = {
  "Shirt Full Sleeve": f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Neck:കഴുത്ത്", "Cuff:കഫ്"),
  "Shirt Half Sleeve": f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Neck:കഴുത്ത്"),
  "Pant / Trouser": f("Length:നീളം", "Waist:അര", "Seat:സീറ്റ്", "Thigh:തുട", "Knee:മുട്ട്", "Bottom:ബോട്ടം"),
  "School Uniform Trouser": f("Length:നീളം", "Waist:അര", "Seat:സീറ്റ്", "Thigh:തുട", "Knee:മുട്ട്", "Bottom:ബോട്ടം"),
  "Churidar Top": f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Hip:ഇടുപ്പ്", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Armhole:കൈക്കുഴി", "Neck-F:കഴുത്ത് മുൻ", "Neck-B:കഴുത്ത് പിൻ"),
  "Churidar Bottom": f("Waist:അര", "Hip:ഇടുപ്പ്", "Length:നീളം", "Thigh:തുട", "Ankle:കണങ്കാൽ"),
  Blouse: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Armhole:കൈക്കുഴി", "Neck-F:കഴുത്ത് മുൻ", "Neck-B:കഴുത്ത് പിൻ"),
  Frock: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Hip:ഇടുപ്പ്", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Neck:കഴുത്ത്"),
  Other: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Shoulder:തോൾ", "Sleeve:കൈ നീളം"),
};
export const GARMENT_TYPES = Object.keys(GARMENTS);

function f(...pairs: string[]) {
  return pairs.map((p) => {
    const [en, ml] = p.split(":");
    return { en, ml };
  });
}
