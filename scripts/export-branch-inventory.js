#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function git(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function safeGit(args) {
  try {
    return git(args);
  } catch {
    return "";
  }
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

function slugifyBranch(ref) {
  return ref
    .replace(/^origin\//, "")
    .replace(/[\\/]+/g, "__")
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function topChangedFiles(base, ref) {
  const ignoredRoots = new Set([".tmp", "tmp", "coverage", "dist"]);
  const statLines = lines(safeGit(["diff", "--numstat", `${base}..${ref}`]));
  return statLines
    .map((line) => {
      const [add, del, ...rest] = line.split("\t");
      const file = rest.join("\t");
      const added = Number(add);
      const deleted = Number(del);
      const score = (Number.isFinite(added) ? added : 0) + (Number.isFinite(deleted) ? deleted : 0);
      return { file, score };
    })
    .filter((item) => item.file && !ignoredRoots.has(item.file.split("/")[0]))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, 15);
}

function topAreas(base, ref) {
  const areaCounts = new Map();
  const files = lines(safeGit(["diff", "--name-only", `${base}..${ref}`]));

  for (const file of files) {
    const parts = file.split("/");
    if (parts[0] === ".tmp" || parts[0] === "tmp") continue;
    const area =
      parts.length >= 2 && ["app", "lib", "data", "tests-e2e", "docs", "backend"].includes(parts[0])
        ? `${parts[0]}/${parts[1]}`
        : parts[0];
    areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
  }

  return Array.from(areaCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);
}

function remoteRepoUrl() {
  const url = safeGit(["config", "--get", "remote.origin.url"]);
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url.replace(/\.git$/, "");
  }
  const sshMatch = url.match(/^git@github\.com:(.+?)(?:\.git)?$/);
  if (sshMatch) return `https://github.com/${sshMatch[1]}`;
  return null;
}

const base = process.argv[2] || "origin/main";
const outputDir = path.join(process.cwd(), "docs", "branch-inventory");
ensureDir(outputDir);

const repoUrl = remoteRepoUrl();
const refs = lines(safeGit(["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin"]))
  .filter((ref) => ref !== "origin/HEAD" && ref !== base)
  .sort((a, b) => a.localeCompare(b));

const generated = [];

for (const ref of refs) {
  const uniqueCount = Number(safeGit(["rev-list", "--count", `${base}..${ref}`]) || "0");
  if (!Number.isFinite(uniqueCount) || uniqueCount === 0) continue;

  const head = safeGit(["rev-parse", "--short=7", ref]);
  const compareUrl = repoUrl ? `${repoUrl}/compare/main...${ref.replace(/^origin\//, "")}` : null;
  const commits = lines(
    safeGit([
      "log",
      "--date=short",
      "--pretty=format:%h|%ad|%an|%s",
      `${base}..${ref}`,
    ]),
  );
  const hotspots = topAreas(base, ref);
  const files = topChangedFiles(base, ref);

  const filename = `${slugifyBranch(ref)}.md`;
  const absPath = path.join(outputDir, filename);

  const sections = [];
  sections.push(`# ${ref}`);
  sections.push("");
  sections.push(`- base: \`${base}\``);
  sections.push(`- head: \`${head}\``);
  sections.push(`- unique commits: ${uniqueCount}`);
  if (compareUrl) {
    sections.push(`- compare: ${compareUrl}`);
  }
  sections.push("");
  sections.push("## Hotspots");
  sections.push("");
  for (const [area, count] of hotspots) {
    sections.push(`- ${area}: ${count} arquivos`);
  }
  if (!hotspots.length) {
    sections.push("- sem hotspots relevantes");
  }
  sections.push("");
  sections.push("## Top Files");
  sections.push("");
  for (const item of files) {
    sections.push(`- ${item.file} (${item.score} linhas alteradas)`);
  }
  if (!files.length) {
    sections.push("- sem arquivos relevantes");
  }
  sections.push("");
  sections.push("## Commits");
  sections.push("");
  for (const commit of commits) {
    const [hash, date, author, ...messageParts] = commit.split("|");
    sections.push(`- \`${hash}\` ${date} ${author}: ${messageParts.join("|")}`);
  }
  if (!commits.length) {
    sections.push("- sem commits exclusivos");
  }
  sections.push("");

  fs.writeFileSync(absPath, `${sections.join("\n")}\n`, "utf8");
  generated.push({ ref, filename, uniqueCount, head });
}

generated.sort((a, b) => b.uniqueCount - a.uniqueCount || a.ref.localeCompare(b.ref));

const indexLines = [];
indexLines.push("# Branch Inventory");
indexLines.push("");
indexLines.push(`Base: \`${base}\``);
indexLines.push("");
indexLines.push("| Branch | Head | Unique commits | Inventory |");
indexLines.push("| --- | --- | ---: | --- |");
for (const item of generated) {
  indexLines.push(
    `| ${item.ref} | \`${item.head}\` | ${item.uniqueCount} | [${item.filename}](./${item.filename}) |`,
  );
}
indexLines.push("");

fs.writeFileSync(path.join(outputDir, "README.md"), `${indexLines.join("\n")}\n`, "utf8");

console.log(`Generated ${generated.length} inventory files in ${path.relative(process.cwd(), outputDir)}`);
