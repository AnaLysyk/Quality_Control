#!/usr/bin/env node

const token = process.env.SONAR_TOKEN?.trim();
const pullRequest = process.env.SONAR_PULL_REQUEST?.trim();
const branch = process.env.SONAR_BRANCH?.trim() || "main";
const projectKey = "AnaLysyk_Quality_Control";
const host = "https://sonarcloud.io";

if (!token) {
  console.error("SONAR_TOKEN não está definido.");
  process.exit(1);
}

const authorization = `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
const scope = pullRequest
  ? { pullRequest }
  : { branch };

function readMetric(component, metric) {
  const measure = component.measures?.find((item) => item.metric === metric);
  const raw = measure?.periods?.[0]?.value ?? measure?.value;
  const value = Number(raw ?? 0);
  return Number.isFinite(value) ? value : 0;
}

async function sonarGet(pathname, params) {
  const url = new URL(pathname, host);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      authorization,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sonar API ${response.status}: ${body}`);
  }

  return response.json();
}

async function waitForAnalysis() {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const status = await sonarGet("/api/qualitygates/project_status", {
      projectKey,
      ...scope,
    });

    if (status.projectStatus) return status.projectStatus;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("A análise do Sonar não ficou disponível dentro da janela de diagnóstico.");
}

async function main() {
  const projectStatus = await waitForAnalysis();
  const tree = await sonarGet("/api/measures/component_tree", {
    component: projectKey,
    metricKeys: "new_coverage,new_lines_to_cover,new_uncovered_lines",
    strategy: "leaves",
    qualifiers: "FIL",
    ps: 500,
    ...scope,
  });

  const files = (tree.components ?? [])
    .map((component) => ({
      path: component.path ?? component.name,
      coverage: readMetric(component, "new_coverage"),
      linesToCover: readMetric(component, "new_lines_to_cover"),
      uncoveredLines: readMetric(component, "new_uncovered_lines"),
    }))
    .filter((file) => file.linesToCover > 0 || file.uncoveredLines > 0)
    .sort((a, b) => b.uncoveredLines - a.uncoveredLines || a.coverage - b.coverage);

  const coverageCondition = projectStatus.conditions?.find(
    (condition) => condition.metricKey === "new_coverage",
  );

  console.log("\n=== SONAR NEW CODE COVERAGE ===");
  console.log(`Escopo: ${pullRequest ? `PR #${pullRequest}` : `branch ${branch}`}`);
  console.log(`Quality Gate: ${projectStatus.status}`);
  if (coverageCondition) {
    console.log(
      `Cobertura total: ${coverageCondition.actualValue}% (mínimo ${coverageCondition.errorThreshold}%)`,
    );
  }
  console.log("\nArquivos com maior quantidade de linhas novas não cobertas:");
  console.log("uncovered\tto-cover\tcoverage\tfile");
  for (const file of files) {
    console.log(
      `${file.uncoveredLines}\t${file.linesToCover}\t${file.coverage.toFixed(1)}%\t${file.path}`,
    );
  }

  const total = files.reduce(
    (acc, file) => ({
      uncoveredLines: acc.uncoveredLines + file.uncoveredLines,
      linesToCover: acc.linesToCover + file.linesToCover,
    }),
    { uncoveredLines: 0, linesToCover: 0 },
  );

  console.log(
    `\nTotal listado: ${total.uncoveredLines}/${total.linesToCover} linhas novas sem cobertura.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
