import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@anime-forge/ai",
    "@anime-forge/config",
    "@anime-forge/credits",
    "@anime-forge/ui",
  ],
  // monorepo: allow importing personas JSON from content/
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
