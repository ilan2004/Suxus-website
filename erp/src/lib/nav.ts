import {
  Palette,
  KanbanSquare,
  LayoutDashboard,
  ShoppingBag,
  Scissors,
  Building2,
  Users,
  Ruler,
  Layers,
  Truck,
  Contact,
  BookOpen,
  HandCoins,
  BadgePercent,
  UserCog,
  Hammer,
  Package,
  Landmark,
  BarChart3,
  Settings,
  Tags,
  Shirt,
  QrCode,
  type LucideIcon,
} from "lucide-react";
import type { Perm } from "./permissions";

export type NavItem = { href: string; en: string; ml: string; icon: LucideIcon; perm?: Perm; soon?: boolean; /** opens in a new tab (a shortcut to a public page) */ newTab?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Daily",
    items: [
      { href: "/", en: "Dashboard", ml: "ഡാഷ്ബോർഡ്", icon: LayoutDashboard },
      { href: "/sales", en: "Fabric Sales", ml: "തുണി വിൽപ്പന", icon: ShoppingBag },
      { href: "/orders", en: "Stitching Orders", ml: "തയ്യൽ ഓർഡർ", icon: Scissors },
      { href: "/orders/board", en: "Order board", ml: "ഓർഡർ ബോർഡ്", icon: KanbanSquare },
      { href: "/bulk", en: "Bulk Orders", ml: "ബൾക്ക് ഓർഡർ", icon: Building2 },
      { href: "/cash-book", en: "Cash Book", ml: "ക്യാഷ് ബുക്ക്", icon: BookOpen },
      // the customers' public try-on page — only a shortcut, opens in a new tab
      { href: "/tryon", en: "Try-on", ml: "ട്രൈ-ഓൺ", icon: Shirt, newTab: true },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/customers", en: "Customers", ml: "കസ്റ്റമർ", icon: Users },
      { href: "/measurements", en: "Measurements", ml: "അളവുകൾ", icon: Ruler },
      { href: "/fabrics", en: "Fabric Stock", ml: "തുണി സ്റ്റോക്ക്", icon: Layers },
      { href: "/purchases", en: "Purchases", ml: "വാങ്ങൽ", icon: Truck },
      { href: "/suppliers", en: "Suppliers", ml: "സപ്ലയർ", icon: Contact },
    ],
  },
  {
    label: "Staff",
    items: [
      { href: "/staff", en: "Staff", ml: "ജീവനക്കാർ", icon: UserCog, perm: "staff" },
      { href: "/wages", en: "Tailor Wages", ml: "തയ്യൽ കൂലി", icon: HandCoins },
      { href: "/incentive", en: "Incentive", ml: "ഇൻസെന്റീവ്", icon: BadgePercent, perm: "staff" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/setup-expenses", en: "Setup Expenses", ml: "ഒരുക്കൽ ചെലവ്", icon: Hammer, perm: "money" },
      { href: "/opening-stock", en: "Opening Stock", ml: "ആസ്തി", icon: Package, perm: "money" },
      { href: "/capital", en: "Capital Account", ml: "മുതൽമുടക്ക്", icon: Landmark, perm: "money" },
      { href: "/reports", en: "Summary", ml: "ചുരുക്കം", icon: BarChart3, perm: "money" },
      { href: "/settings/tryon", en: "Try-on QR & enquiries", ml: "ട്രൈ-ഓൺ", icon: QrCode, perm: "prices" },
      { href: "/settings/combos", en: "Shirt + trouser combinations", ml: "കോംബോ", icon: Palette, perm: "prices" },
      { href: "/settings/stitching-prices", en: "Stitching Prices", ml: "തുന്നൽക്കൂലി നിരക്ക്", icon: Tags, perm: "prices" },
      { href: "/settings", en: "Settings", ml: "സെറ്റിംഗ്സ്", icon: Settings, perm: "settings" },
    ],
  },
];

/** Simple measurement mode: a short menu with only what the cutting master uses (Measurements first). */
export const SIMPLE_MENU = ["/measurements", "/orders/board", "/orders", "/customers"];
