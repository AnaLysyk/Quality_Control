/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const TARGETS = [
  path.join(root, "node_modules", "next", "dist", "export", "index.js"),
  path.join(root, "node_modules", "next", "dist", "esm", "export", "index.js"),
];

const PATCH_MARKER = "qc_patch_stripFunctionsForWorkerThreads_v1";

function stripFunctionsDeep(value, seen = new Map()) {
  if (typeof value === "function") return undefined;
  if (value == null) return value;

  const t = typeof value;
  if (t !== "object") return value;

  if (value instanceof RegExp) return value;
  if (value instanceof Date) return value;

  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    for (const item of value) {
      if (typeof item === "function") continue;
      out.push(stripFunctionsDeep(item, seen));
    }
    return out;
  }

  if (value instanceof Map) {
    const out = new Map();
    seen.set(value, out);
    for (const [k, v] of value.entries()) {
      if (typeof k === "function" || typeof v === "function") continue;
      out.set(stripFunctionsDeep(k, seen), stripFunctionsDeep(v, seen));
    }
    return out;
  }

  if (value instanceof Set) {
    const out = new Set();
    seen.set(value, out);
    for (const item of value.values()) {
      if (typeof item === "function") continue;
      out.add(stripFunctionsDeep(item, seen));
    }
    return out;
  }

  const out = {};
  seen.set(value, out);
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "function") continue;
    out[k] = stripFunctionsDeep(v, seen);
  }
  return out;
}

function patchExportIndex(source) {
  if (source.includes(PATCH_MARKER)) return { changed: false, source };

  const exportPagesInBatchesSig =
    "const exportPagesInBatches = async (worker, exportPaths, renderResumeDataCachesByPage)=>{";
  const sigIndex = source.indexOf(exportPagesInBatchesSig);
  if (sigIndex === -1) {
    throw new Error("Patch failed: exportPagesInBatches signature not found.");
  }

  const helper =
    `\n    // ${PATCH_MARKER}\n` +
    "    // Next.js worker threads use structured clone and cannot clone functions.\n" +
    "    // In some builds, `nextConfig` contains functions (e.g. default generateBuildId / exportPathMap)\n" +
    "    // and passing it to a worker thread causes DataCloneError.\n" +
    "    const __qcStripFunctionsForWorkerThreads = (value) => {\n" +
    "        const strip = (val, seen = new Map()) => {\n" +
    "            if (typeof val === 'function') return undefined;\n" +
    "            if (val == null) return val;\n" +
    "            if (typeof val !== 'object') return val;\n" +
    "            if (val instanceof RegExp) return val;\n" +
    "            if (val instanceof Date) return val;\n" +
    "            if (seen.has(val)) return seen.get(val);\n" +
    "            if (Array.isArray(val)) {\n" +
    "                const out = [];\n" +
    "                seen.set(val, out);\n" +
    "                for (const item of val) {\n" +
    "                    if (typeof item === 'function') continue;\n" +
    "                    out.push(strip(item, seen));\n" +
    "                }\n" +
    "                return out;\n" +
    "            }\n" +
    "            if (val instanceof Map) {\n" +
    "                const out = new Map();\n" +
    "                seen.set(val, out);\n" +
    "                for (const [k, v] of val.entries()) {\n" +
    "                    if (typeof k === 'function' || typeof v === 'function') continue;\n" +
    "                    out.set(strip(k, seen), strip(v, seen));\n" +
    "                }\n" +
    "                return out;\n" +
    "            }\n" +
    "            if (val instanceof Set) {\n" +
    "                const out = new Set();\n" +
    "                seen.set(val, out);\n" +
    "                for (const item of val.values()) {\n" +
    "                    if (typeof item === 'function') continue;\n" +
    "                    out.add(strip(item, seen));\n" +
    "                }\n" +
    "                return out;\n" +
    "            }\n" +
    "            const out = {};\n" +
    "            seen.set(val, out);\n" +
    "            for (const [k, v] of Object.entries(val)) {\n" +
    "                if (typeof v === 'function') continue;\n" +
    "                out[k] = strip(v, seen);\n" +
    "            }\n" +
    "            return out;\n" +
    "        };\n" +
    "        return strip(value);\n" +
    "    };\n";

  let patched = source.slice(0, sigIndex) + helper + source.slice(sigIndex);

  // Add sanitized locals at the start of exportPagesInBatches.
  patched = patched.replace(
    exportPagesInBatchesSig,
    exportPagesInBatchesSig +
      "\n        const __qcNextConfigForWorker = __qcStripFunctionsForWorkerThreads(nextConfig);\n" +
      "        const __qcOptionsForWorker = __qcStripFunctionsForWorkerThreads(options);\n",
  );

  // Replace args passed to worker threads: use sanitized versions.
  patched = patched.replace(
    /\boptions,\s*dir,\s*distDir,\s*outDir,\s*nextConfig,\s*cacheHandler:/m,
    "options: __qcOptionsForWorker,\n                dir,\n                distDir,\n                outDir,\n                nextConfig: __qcNextConfigForWorker,\n                cacheHandler:",
  );

  if (patched === source) {
    throw new Error("Patch failed: exportPagesInBatches callsite not updated.");
  }

  return { changed: true, source: patched };
}

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { filePath, status: "missing" };
  }

  const original = fs.readFileSync(filePath, "utf8");
  const { changed, source } = patchExportIndex(original);
  if (!changed) return { filePath, status: "already" };

  // Keep line endings consistent with the existing file.
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const normalized = source.replace(/\r?\n/g, eol);
  fs.writeFileSync(filePath, normalized, "utf8");
  return { filePath, status: "patched" };
}

function main() {
  const results = TARGETS.map(patchFile);
  const patched = results.filter((r) => r.status === "patched").length;
  const already = results.filter((r) => r.status === "already").length;
  const missing = results.filter((r) => r.status === "missing").length;

  if (patched > 0) {
    console.log(`Patched Next export worker config sanitization (${patched} file(s)).`);
  }
  if (already > 0) {
    console.log(`Next export worker patch already applied (${already} file(s)).`);
  }
  if (missing > 0) {
    console.log(`Next export worker patch targets missing (${missing} file(s)).`);
  }
}

main();

