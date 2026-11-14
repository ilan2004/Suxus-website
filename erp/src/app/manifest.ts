import type { MetadataRoute } from "next";

/** "Add to Home Screen" — opens the ERP like an app, with the SUXUS icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SUXUS ERP",
    short_name: "SUXUS",
    description: "Daily operations for SUXUS Heritage Tailor",
    start_url: "/",
    display: "standalone",
    background_color: "#F9F4EB",
    theme_color: "#153D33",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
