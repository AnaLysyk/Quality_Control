#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const token = process.env.SONAR_TOKEN?.trim();
if (!token) {
  console.error("SONAR_TOKEN não está definido.");
  process.exit(1);
}

const componentKey = "AnaLysyk_Quality_Control";
const organization = "analysyk";
const pageSize = 500;
const issues = [];
let page = 1;
let total = 0;

do {
  const url = new URL("https://sonarcloud.io/api/issues/search");
  url.searchParams.set("componentKeys", componentKey);
  url.searchParams.set("organization", organization);
  url.searchParams.set("resolved", "false");
  url.searchParams.set("ps", String(pageSize));
  url.searchParams.set("p", String(page));

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`SonarCloud respondeu ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const currentIssues = Array.isArray(payload.issues) ? payload.issues : [];
  issues.push(...currentIssues);
  total = Number(payload.total ?? currentIssues.length);
  page += 1;
} while (issues.length < total);

const reportDir = path.join(process.cwd(), "reports");
await mkdir(reportDir, { recursive: true });

const jsonPath = path.join(reportDir, "sonar-issues.json");
await writeFile(
  jsonPath,
  `${JSON.stringify({ total: issues.length, issues }, null, 2)}\n`,
  "utf8",
);

const columns = ["key", "severity", "type", "rule", "component", "line", "message", "effort"];
const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csv = [
  columns.map(escapeCsv).join(","),
  ...issues.map((issue) => columns.map((column) => escapeCsv(issue[column])).join(",")),
].join("\n");

const csvPath = path.join(reportDir, "sonar-issues.csv");
await writeFile(csvPath, `${csv}\n`, "utf8");

console.log(`SonarCloud: ${issues.length} issues abertas.`);
console.log(`JSON: ${jsonPath}`);
console.log(`CSV: ${csvPath}`);
