import {
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
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; en: string; ml: string; icon: LucideIcon; partner?: boolean; soon?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Daily",
    items: [
      { href: "/", en: "Dashboard", ml: "ഡാഷ്ബോർഡ്", icon: LayoutDashboard },
      { href: "/sales", en: "Fabric Sales", ml: "തുണി വിൽപ്പന", icon: ShoppingBag },
      { href: "/orders", en: "Stitching Orders", ml: "തയ്യൽ ഓർഡർ", icon: Scissors },
      { href: "/bulk", en: "Bulk Orders", ml: "ബൾക്ക് ഓർഡർ", icon: Building2 },
      { href: "/cash-book", en: "Cash Book", ml: "ക്യാഷ് ബുക്ക്", icon: BookOpen },
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
      { href: "/staff", en: "Staff", ml: "ജീവനക്കാർ", icon: UserCog, partner: true },
      { href: "/wages", en: "Tailor Wages", ml: "തയ്യൽ കൂലി", icon: HandCoins },
      { href: "/incentive", en: "Incentive", ml: "ഇൻസെന്റീവ്", icon: BadgePercent, partner: true, soon: true },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/setup-expenses", en: "Setup Expenses", ml: "ഒരുക്കൽ ചെലവ്", icon: Hammer, partner: true, soon: true },
      { href: "/opening-stock", en: "Opening Stock", ml: "ആസ്തി", icon: Package, partner: true, soon: true },
      { href: "/capital", en: "Capital Account", ml: "മുതൽമുടക്ക്", icon: Landmark, partner: true, soon: true },
      { href: "/reports", en: "Summary", ml: "ചുരുക്കം", icon: BarChart3, partner: true, soon: true },
      { href: "/settings", en: "Settings", ml: "സെറ്റിംഗ്സ്", icon: Settings, partner: true },
    ],
  },
];
