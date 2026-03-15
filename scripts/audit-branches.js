#!/usr/bin/env node

const { execFileSync } = require("node:child_process");

function git(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function safeGitLines(args) {
  try {
    const output = git(args);
    return output ? output.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function countBy(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}

function collectFlags(paths) {
  const flags = new Set();

  for (const file of paths) {
    if (file.startsWith("data/")) flags.add("data");
    if (/(^|\/)\.env(\.|$)/i.test(file)) flags.add("env");
    if (
      file.startsWith("app/api/auth/") ||
      file.startsWith("lib/auth/") ||
      file === "app/middleware.ts" ||
      file === "middleware.ts"
    ) {
      flags.add("auth");
    }
    if (file.startsWith(".github/workflows/")) flags.add("ci");
    if (file.startsWith("tests-e2e/") || file.startsWith("playwright")) flags.add("e2e");
    if (file.startsWith("docs/")) flags.add("docs");
    if (file.startsWith("app/") || file.startsWith("components/") || file.startsWith("lib/")) {
      flags.add("app");
    }
  }

  return Array.from(flags).sort();
}

function collectHotspots(paths) {
  const ignoredRoots = new Set([".tmp", "tmp", "coverage", "dist"]);

  const areas = paths
    .filter((file) => !ignoredRoots.has(file.split("/")[0]))
    .map((file) => {
    const parts = file.split("/");
    if (parts.length >= 2 && (parts[0] === "app" || parts[0] === "lib" || parts[0] === "data")) {
      return `${parts[0]}/${parts[1]}`;
    }
    return parts[0];
    });

  return Array.from(countBy(areas).entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([name, count]) => `${name} (${count})`);
}

function escapeCell(value) {
  return value.replace(/\|/g, "\\|");
}

const base = process.argv[2] || "origin/main";
const generatedAt = new Date().toISOString();

const refs = safeGitLines(["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin"])
  .filter((ref) => ref !== "origin/HEAD" && ref !== base)
  .sort((a, b) => a.localeCompare(b));

const rows = [];

for (const ref of refs) {
  const uniqueCount = Number(git(["rev-list", "--count", `${base}..${ref}`]));
  if (!Number.isFinite(uniqueCount) || uniqueCount === 0) {
    continue;
  }

  const head = git(["rev-parse", "--short=7", ref]);
  const files = safeGitLines(["diff", "--name-only", `${base}..${ref}`]);
  const recentCommits = safeGitLines(["log", "--oneline", "-3", `${base}..${ref}`]);
  const flags = collectFlags(files);
  const hotspots = collectHotspots(files);

  rows.push({
    ref,
    head,
    uniqueCount,
    flags,
    hotspots,
    recentCommits,
  });
}

rows.sort((a, b) => b.uniqueCount - a.uniqueCount || a.ref.localeCompare(b.ref));

console.log("# Branch Audit");
console.log("");
console.log(`Base: \`${base}\``);
console.log(`Generated: \`${generatedAt}\``);
console.log("");
console.log("| Branch | Head | Unique commits | Flags | Hotspots |");
console.log("| --- | --- | ---: | --- | --- |");

for (const row of rows) {
  console.log(
    `| ${escapeCell(row.ref)} | \`${row.head}\` | ${row.uniqueCount} | ${escapeCell(
      row.flags.join(", ") || "none",
    )} | ${escapeCell(row.hotspots.join(", ") || "-")} |`,
  );
}

console.log("");

for (const row of rows) {
  console.log(`## ${row.ref}`);
  console.log("");
  console.log(`- head: \`${row.head}\``);
  console.log(`- unique commits vs ${base}: ${row.uniqueCount}`);
  console.log(`- flags: ${row.flags.join(", ") || "none"}`);
  console.log(`- hotspots: ${row.hotspots.join(", ") || "-"}`);
  console.log("- latest commits:");
  for (const commit of row.recentCommits) {
    console.log(`  - ${commit}`);
  }
  console.log("");
}
