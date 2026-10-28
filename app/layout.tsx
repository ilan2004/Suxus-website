import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, Noto_Sans_Malayalam } from "next/font/google";
import { Header } from "@/components/Header";
import { CtaBand, Footer, OfferBanner, WhatsAppFloat } from "@/components/Site";
import { business, SITE_URL } from "@/lib/site";
import "./globals.css";

const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const malayalam = Noto_Sans_Malayalam({ subsets: ["malayalam"], weight: ["400", "500"], variable: "--font-ml" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SUXUS | Heritage Tailor — Uniforms, Fabrics & Tailoring in Pallikkal, Malappuram",
    template: "%s | SUXUS Heritage Tailor, Pallikkal",
  },
  description:
    "SUXUS, Heritage Tailor at Kadoor Complex, Pallikkal Bazar. School and institutional uniforms, shirting and suiting fabrics, and gents tailoring for Pallikkal, Malappuram, Kondotty, Chelari and Ramanattukara.",
  openGraph: {
    siteName: "SUXUS | Heritage Tailor",
    locale: "en_IN",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#153D33" };

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ClothingStore",
  "@id": `${SITE_URL}/#business`,
  name: "SUXUS — Heritage Tailor",
  description: "Tailoring, school and institutional uniforms, and shirting and suiting fabrics.",
  url: SITE_URL,
  email: business.email,
  telephone: business.phones.map((p) => p.tel),
  address: {
    "@type": "PostalAddress",
    streetAddress: business.address.street,
    addressLocality: business.address.locality,
    addressRegion: "Kerala",
    postalCode: business.address.postalCode,
    addressCountry: "IN",
  },
  areaServed: business.areas,
  hasMap: business.googleProfile,
  sameAs: [business.instagram, business.facebook],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${interTight.variable} ${inter.variable} ${malayalam.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <OfferBanner />
        <Header />
        <main id="main">{children}</main>
        <CtaBand />
        <Footer />
        <WhatsAppFloat />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}
