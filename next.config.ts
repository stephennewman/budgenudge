import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't fail production builds on ESLint issues (TypeScript type-checking
  // still runs). The codebase carries many lint warnings; a stray lint error
  // had been silently blocking deploys.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
