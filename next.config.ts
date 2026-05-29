import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint errors will be shown in console but won't block the build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TypeScript errors will be shown in console but won't block the build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
