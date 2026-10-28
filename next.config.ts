import type { NextConfig } from "next";

// Static export: `npm run build` writes a plain HTML site to ./out that can be
// uploaded to any host on suxus.shop without a Node server.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
