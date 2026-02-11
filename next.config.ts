import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  turbopack: {
    // Force workspace root to this project directory and avoid parent lockfile detection.
    root: process.cwd(),
  },
};

export default nextConfig;
