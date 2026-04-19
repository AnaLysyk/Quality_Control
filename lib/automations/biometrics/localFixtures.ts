import fs from "node:fs";
import path from "node:path";

import { BIOMETRIC_FIXTURE_DEFINITIONS } from "@/data/biometricFixtures";

export type LocalBiometricFixture = {
  index: number | null;
  isStandard: boolean;
  kind: "face" | "fingerprint";
  label: string;
  path: string;
  slug: string;
};

export const DEFAULT_BIOMETRIC_FIXTURES_DIR =
  process.env.BIOMETRIC_FIXTURES_DIR || "C:\\Users\\Testing Company\\Pictures\\Screenshots\\Digitais";

const fixturePath = (fileName: string) => path.join(DEFAULT_BIOMETRIC_FIXTURES_DIR, fileName);

export const LOCAL_BIOMETRIC_FIXTURES: LocalBiometricFixture[] = BIOMETRIC_FIXTURE_DEFINITIONS.map((fixture) => ({
  ...fixture,
  path: fixturePath(fixture.fileName),
}));

export function resolveExistingLocalBiometricFixtures() {
  return LOCAL_BIOMETRIC_FIXTURES.filter((fixture) => fs.existsSync(fixture.path));
}

export function findLocalBiometricFixture(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  return LOCAL_BIOMETRIC_FIXTURES.find((fixture) => fixture.slug === normalizedSlug) ?? null;
}
