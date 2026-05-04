const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next";

const nextConfig = {
  distDir,
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ["localhost", "127.0.0.1", "172.16.19.244"],
  devIndicators: {
    buildActivity: false, // esconde o indicador/loader do Next no canto
  },
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [
      {
        pathname: "/images/**",
      },
      {
        pathname: "/api/s3/object",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["react-icons", "recharts", "framer-motion"],
  },
  turbopack: {
    root: __dirname,
  },
  webpack: (config: { watchOptions?: { ignored?: string[] } }, { dev }: { dev: boolean }) => {
    if (dev) {
      const ignored = new Set<string>([
        ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions?.ignored : []),
        "**/data/**",
      ]);
      config.watchOptions = { ...(config.watchOptions ?? {}), ignored: Array.from(ignored) };
    }
    return config;
  },
};
module.exports = nextConfig;
