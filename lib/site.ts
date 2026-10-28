// Single source for SUXUS business details. Edit here; every page picks it up.

export const SITE_URL = "https://suxus.shop";

export const business = {
  name: "SUXUS",
  tagline: "Heritage Tailor",
  strip: "Uniforms • Fabrics • Tailoring",
  malayalamLine: "തുണിക്ക് മികവ്, വസ്ത്രത്തിന് വ്യക്തിത്വം",
  address: {
    street: "Kadoor Complex, Pallikkal Bazar",
    locality: "Pallikkal",
    region: "Malappuram, Kerala",
    postalCode: "673635",
  },
  phones: [
    { display: "98461 86713", tel: "+919846186713", who: "Krishnankutty", role: "Shop" },
    { display: "95673 56072", tel: "+919567356072", who: "Sahim KT", role: "Orders & institutions" },
  ],
  whatsapp: "919567356072",
  email: "Info@suxus.shop",
  instagram: "https://www.instagram.com/suxusofficial/",
  instagramHandle: "@suxusofficial",
  // TODO: replace with the exact SUXUS Facebook Page URL.
  facebook: "https://www.facebook.com/search/top?q=SUXUS%20Pallikkal",
  googleProfile:
    "https://www.google.com/maps/search/?api=1&query=SUXUS+Tailor+Kadoor+Complex+Pallikkal+Bazar",
  mapEmbed:
    "https://maps.google.com/maps?q=SUXUS%20Tailor%2C%20Kadoor%20Complex%2C%20Pallikkal%20Bazar%2C%20Malappuram&output=embed",
  areas: ["Pallikkal", "Malappuram", "Kondotty", "Chelari", "Ramanattukara"],
};

export const fullAddress = `${business.address.street}, ${business.address.locality}, ${business.address.region} ${business.address.postalCode}`;

export const WA_GREETING = "Hello SUXUS | Heritage Tailor, I would like to know more.";

export function waLink(text: string = WA_GREETING) {
  return `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(text)}`;
}

export const nav = [
  { href: "/", label: "Home" },
  { href: "/school-uniforms/", label: "School Uniforms" },
  { href: "/institutional-uniforms/", label: "Institutional & Corporate" },
  { href: "/tailoring-fabrics/", label: "Tailoring & Fabrics" },
  { href: "/catalogues/", label: "Catalogues" },
  { href: "/about-contact/", label: "About & Contact" },
];

/* Offer banner — switch on for Onam, Eid, school reopening or wedding season.
   Never put prices here. */
export const offer = {
  active: false,
  text: "Onam dress codes for families and groups — book your stitching early.",
  href: "/tailoring-fabrics/#festival",
  linkText: "See details",
};

export const priceNote = "Price confirmed on enquiry";
export const priceNoteMl = "വില അന്വേഷണത്തിൽ അറിയിക്കും";
