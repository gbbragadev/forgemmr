import type { NextConfig } from "next";
import path from "path";

// GitHub Pages (project site): set PAGES_BASE_PATH=/anime-forge no CI
const pagesBase = process.env.PAGES_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = {
  // Static export — free path sem API; host estático (GitHub Pages / CF / etc.)
  output: "export",
  basePath: pagesBase || undefined,
  assetPrefix: pagesBase || undefined,
  transpilePackages: ["@forge/config", "@forge/ui"],
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@content": path.resolve(__dirname, "../../content"),
    };
    return config;
  },
};

export default nextConfig;
