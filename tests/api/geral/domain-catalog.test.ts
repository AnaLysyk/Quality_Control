import fs from "node:fs";
import path from "node:path";

import { DOMAIN_CATALOG } from "@/backend/architecture/domainCatalog";

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, "database", "prisma", "schema.prisma");

function absolute(relativePath: string) {
  return path.join(ROOT, ...relativePath.split("/"));
}

describe("canonical domain catalog", () => {
  it("uses unique, searchable canonical ids", () => {
    const ids = DOMAIN_CATALOG.map((domain) => domain.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("only references locations that exist in the repository", () => {
    const missing = DOMAIN_CATALOG.flatMap((domain) =>
      Object.entries(domain.locations).flatMap(([layer, locations]) =>
        locations
          .filter((location) => !fs.existsSync(absolute(location)))
          .map((location) => `${domain.id}.${layer}: ${location}`),
      ),
    );

    expect(missing).toEqual([]);
  });

  it("references Prisma models declared by the official schema", () => {
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    const missingModels = DOMAIN_CATALOG.flatMap((domain) =>
      domain.prismaModels
        .filter((model) => !new RegExp(`^model\\s+${model}\\s+\\{`, "m").test(schema))
        .map((model) => `${domain.id}: ${model}`),
    );

    expect(missingModels).toEqual([]);
  });

  it("connects every business domain to frontend, API and backend", () => {
    const disconnected = DOMAIN_CATALOG.flatMap((domain) =>
      (["frontend", "api", "backend"] as const)
        .filter((layer) => domain.locations[layer].length === 0)
        .map((layer) => `${domain.id}.${layer}`),
    );

    expect(disconnected).toEqual([]);
  });
});
