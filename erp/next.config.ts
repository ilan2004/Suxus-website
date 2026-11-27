import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in /erp inside the website repo — keep tracing scoped to it.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  serverExternalPackages: ["@electric-sql/pglite", "exceljs", "pdfkit"],
  // Job slip PDF: the Malayalam font it embeds is read from disk at runtime
  // Try-on: the watermark is read from disk at runtime
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"], "/j/**": ["./assets/fonts/**/*"], "/api/tryon/**": ["./assets/tryon-watermark.png"] },
};

export default nextConfig;
