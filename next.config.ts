import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

import { SECURITY_HEADERS } from "./lib/security/headers";

const nextConfig: NextConfig = {
  logging: {
    // Server Actions carry passwords and CAPTCHA tokens. Never echo their
    // invocation arguments into local or hosted runtime logs.
    serverFunctions: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  turbopack: {
    // Force workspace root to this project directory and avoid parent lockfile detection.
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
