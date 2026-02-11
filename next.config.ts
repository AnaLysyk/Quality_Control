// Turbopack (Windows) does not accept drive-letter absolute paths in resolveAlias.
// Use a project-relative path (posix-ish) for Turbopack, and an absolute path for Webpack.
const reactIsShimTurbo = "./lib/shims/react-is.ts";

const nextConfig = {
  devIndicators: {
    buildActivity: false, // esconde o indicador/loader do Next no canto
  },
  experimental: {
    // Locked-down environments may block spawning Node child processes with piped stdio (EPERM).
    // Worker threads keep the build in-process and avoid that failure mode.
    workerThreads: true,
  },
  turbopack: {
    root: __dirname,
    // Keep builds stable even when peer deps are pruned or offline installs happen.
    resolveAlias: {
      "react-is": reactIsShimTurbo,
    },
  },
};
module.exports = nextConfig;
