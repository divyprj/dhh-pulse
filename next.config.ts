import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Server Components and App Router — enabled by default in Next 15
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/image/**",
      },
      {
        protocol: "https",
        hostname: "seeded-session-images.scdn.co",
        pathname: "/**",
      },
    ],
  },
  // Exclude native node modules from client bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "better-sqlite3": false,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
