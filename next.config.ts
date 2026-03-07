const path = require("path");

const nextConfig = {
  devIndicators: {
    buildActivity: false, // esconde o indicador/loader do Next no canto
  },
  turbopack: {
    root: __dirname,
  },
  webpack: (config: any, { dev }: { dev: boolean }) => {
    // ensure webpack knows the tsconfig path aliases for runtime resolution
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@/lib": path.resolve(__dirname, "lib"),
    };
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
