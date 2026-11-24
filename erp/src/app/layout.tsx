import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, Noto_Sans_Malayalam } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display-face" });
const malayalam = Noto_Sans_Malayalam({ subsets: ["malayalam"], weight: ["400", "500"], variable: "--font-ml-face" });

/** No page should ever take this long; if the database stalls, fail after 60 s instead of holding a function for 300 s. */
export const maxDuration = 60;

export const metadata: Metadata = {
  title: { default: "SUXUS ERP", template: "%s · SUXUS ERP" },
  description: "Daily operations for SUXUS Heritage Tailor",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "SUXUS", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#153D33", width: "device-width", initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${interTight.variable} ${malayalam.variable}`}>
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
