const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next";

// Resolve build version: prefer CI env, fallback to git short hash, then package version
function resolveAppVersion(): string {
  if (process.env.NEXT_PUBLIC_APP_VERSION) return process.env.NEXT_PUBLIC_APP_VERSION;
  try {
    const { execSync } = require("child_process") as typeof import("child_process");
    const hash = execSync("git rev-parse --short HEAD", { encoding: "utf8", stdio: ["pipe","pipe","ignore"] }).trim();
    if (hash) return hash;
  } catch { /* no git */ }
  try {
    const pkg = require("./package.json") as { version?: string };
    if (pkg.version) return `v${pkg.version}`;
  } catch { /* ignore */ }
  return "dev";
}

const APP_VERSION = resolveAppVersion();
const DEPLOYMENT_ID =
  process.env.NEXT_DEPLOYMENT_ID?.trim() ||
  process.env.RENDER_GIT_COMMIT?.trim() ||
  APP_VERSION;

const nextConfig = {
  distDir,
  deploymentId: DEPLOYMENT_ID,
  poweredByHeader: false,
  reactStrictMode: true,
  // Ignore TS errors in Next.js auto-generated route types (Next.js 16 bug with nested dynamic segments)
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
  allowedDevOrigins: ["localhost", "127.0.0.1", "172.16.19.244"],
  async redirects() {
    return [
      {
        source: "/runs",
        destination: "/operacao",
        permanent: false,
      },
      {
        source: "/admin/runs",
        destination: "/admin/operacao",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/operacao",
        destination: "/runs",
      },
      {
        source: "/admin/operacao",
        destination: "/admin/runs",
      },
    ];
  },
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
        ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
        "**/data/**",
      ]);
      config.watchOptions = { ...(config.watchOptions ?? {}), ignored: Array.from(ignored) };
    }
    return config;
  },
};
module.exports = nextConfig;
