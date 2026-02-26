import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "mammoth", "jsdom"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
