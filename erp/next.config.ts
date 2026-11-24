import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in /erp inside the website repo — keep tracing scoped to it.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  serverExternalPackages: ["@electric-sql/pglite", "exceljs"],
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default nextConfig;
