const nextConfig = {
  devIndicators: {
    buildActivity: false, // esconde o indicador/loader do Next no canto
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
