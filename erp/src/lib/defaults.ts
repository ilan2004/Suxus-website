/** Defaults copied from the "Lists", "Incentive" and "Size Chart" sheets of the SUXUS Daily Operations Book. */

export const DEFAULT_LISTS = {
  workType: ["Shop Fabric Stitching", "Outside Fabric Stitching", "Alteration", "Bulk / Institution", "Readymade Sale"],
  item: [
    "Shirt", "Pant", "Shirt+Pant Set", "Kurta", "School Shirt", "School Pant", "School Skirt", "Uniform Shirt",
    "Uniform Pant", "Chef Coat", "Apron", "T-Shirt", "Alteration - Pant Length", "Alteration - Waist",
    "Alteration - Shirt Fitting", "Alteration - Other", "Other", "Churidar", "Blouse",
  ],
  status: ["Booked", "Cut", "Stitching", "Ready", "Delivered", "Cancelled"],
  paymentMode: ["Cash", "GPay/UPI", "Card", "Bank Transfer", "Credit (Due)"],
  fabricType: ["Linen", "Shirting", "Suiting", "Uniform Shirting", "Uniform Suiting", "White Shirting", "White Mundu", "Check", "Other"],
  cashCategory: [
    "Fabric Sale", "Stitching Income", "Alteration Income", "Bulk Order Income", "Advance Received", "Fabric Purchase",
    "Tailor Wages", "Staff Salary", "Incentive Paid", "Setup / Renovation", "Rent", "Electricity", "Transport",
    "Embroidery", "Printing / Marketing", "Other Expense", "Owner Withdrawal", "Capital Introduced",
  ],
  setupCategory: [
    "Renovation - Partition", "Renovation - Ceiling", "Renovation - Flooring", "Renovation - Electrical",
    "Renovation - Lamination / Shelf", "Renovation - Painting", "Furniture & Fittings", "Sign Board",
    "Branding & Printing", "Catalogue Purchase", "Machinery & Equipment", "Computer & Software", "Licence & Fees",
    "Advance to Supplier", "Deposit / Rent Advance", "Transport", "Site Protection & Consumables", "Other Setup", "Embroidery",
  ],
  partner: ["Sahim KT", "Krishnankutty", "Business Account"],
  staffRole: ["Partner", "Cutting Master", "Tailor", "Marketing", "Shop Sales", "Ironing", "Helper", "Embroidery"],
  payType: ["Partner (No Salary)", "Monthly Salary", "Piece Rate", "Salary + Incentive", "Commission Only"],
  assetType: ["Fabric Stock", "Sewing Machine", "Cutting Table", "Furniture / Shelf", "Tools", "Electrical", "Other", "Security Deposit"],
  urgency: ["Normal", "Express"],
  customerType: ["Walk-in", "Regular", "Institution", "Corporate", "Wholesale"],
  colourFamily: [
    "White", "Off-White / Cream", "Black", "Grey", "Navy Blue", "Sky Blue", "Blue", "Green", "Sea Green", "Maroon",
    "Red", "Pink", "Orange", "Yellow", "Brown", "Beige", "Purple", "Check / Stripe", "Multicolour / Print", "Other",
  ],
  fit: ["Regular", "Slim", "Loose"],
};
export type ListKey = keyof typeof DEFAULT_LISTS;
export type Lists = Record<ListKey, string[]>;

export const LIST_LABELS: Record<ListKey, { en: string; ml: string }> = {
  workType: { en: "Work Type", ml: "വർക്ക് തരം" },
  item: { en: "Item", ml: "ഐറ്റം" },
  status: { en: "Order Status", ml: "സ്റ്റാറ്റസ്" },
  paymentMode: { en: "Payment Mode", ml: "പേയ്‌മെന്റ്" },
  fabricType: { en: "Fabric Type", ml: "തുണി തരം" },
  cashCategory: { en: "Cash Book Category", ml: "ക്യാഷ് വിഭാഗം" },
  setupCategory: { en: "Setup Category", ml: "ഒരുക്കൽ വിഭാഗം" },
  partner: { en: "Partners / Paid By", ml: "പാർട്ണർ" },
  staffRole: { en: "Staff Role", ml: "ജോലി" },
  payType: { en: "Pay Type", ml: "ശമ്പള രീതി" },
  assetType: { en: "Asset Type", ml: "ആസ്തി തരം" },
  urgency: { en: "Urgency", ml: "അടിയന്തരം" },
  customerType: { en: "Customer Type", ml: "കസ്റ്റമർ തരം" },
  colourFamily: { en: "Colour Family", ml: "കളർ വിഭാഗം" },
  fit: { en: "Fit", ml: "ഫിറ്റ്" },
};

/** Fabric composition → code prefix (LIN-001, PV-002 …). */
export const DEFAULT_COMPOSITIONS: { name: string; prefix: string }[] = [
  { name: "Linen", prefix: "LIN" },
  { name: "Poly-Viscose (P.V.)", prefix: "PV" },
  { name: "Poly-Cotton (P.C.)", prefix: "PC" },
  { name: "Cotton", prefix: "COT" },
  { name: "Polyester", prefix: "POL" },
  { name: "Poly-Wool", prefix: "PW" },
  { name: "Viscose", prefix: "VIS" },
  { name: "Denim", prefix: "DEN" },
  { name: "PV Lycra / Stretch", prefix: "PVL" },
  { name: "PC Lycra / Stretch", prefix: "PCL" },
  { name: "Cotton-Tencel", prefix: "CTN" },
  { name: "Cotton-Linen", prefix: "CL" },
  { name: "Other", prefix: "OTH" },
];

export const DEFAULT_SHOP = {
  name: "SUXUS",
  tagline: "HERITAGE TAILOR",
  services: "Uniforms | Fabrics | Tailoring",
  address1: "Kadoor Complex, Pallikkal Bazar",
  address2: "Pallikkal, Malappuram, Kerala 673635",
  phone: "95443 76072",
  email: "Info@suxus.shop",
  gstin: "",
  footer: "Thank you, visit again",
  billTerms: "Please bring this bill on delivery\nNot responsible after 30 days",
  invoiceTerms:
    "Goods once delivered will not be taken back. Payment due on delivery unless agreed otherwise.",
  normalDays: 2,
  expressDays: 1,
  lowStockMtr: 5,
};
export type ShopInfo = typeof DEFAULT_SHOP;

/** Piece Rate Master — tailor wage per item (₹). */
export const DEFAULT_PIECE_RATES: Record<string, number> = { Shirt: 100, Pant: 40 };

/** Incentive slabs on amount collected in a month. */
export const DEFAULT_SLABS: { from: number; to: number; rate: number }[] = [
  { from: 0, to: 50000, rate: 0.01 },
  { from: 50001, to: 150000, rate: 0.015 },
  { from: 150001, to: 300000, rate: 0.02 },
  { from: 300001, to: 99999999, rate: 0.025 },
];

export const DEFAULT_SIZE_CHART = {
  sizes: ["S (36)", "M (38)", "L (40)", "XL (42)", "2XL (44)", "3XL (46)", "4XL (48)"],
  rows: [
    { label: "Full Chest", values: [39, 42, 44, 46, 50, 53, 57] },
    { label: "Sleeve Length", values: [24, 24.5, 25, 25.5, 26, 26.5, 27] },
    { label: "Neck", values: [14.5, 15, 15.5, 16.5, 17, 18, 19.5] },
    { label: "Front Length", values: [27, 28.5, 30, 30.5, 31.5, 33, 34] },
  ],
};
