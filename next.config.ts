import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // OptimizedImage requests these qualities per variant. Next 16 defaults
    // `qualities` to [75] and rejects any other value (400 from the optimizer),
    // so every declared quality must be listed here or those variants break.
    qualities: [60, 75, 85],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
