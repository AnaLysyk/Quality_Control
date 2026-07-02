import { test as base } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type ResolvedAsset = {
  assetId: string;
  key: string;
  mimeType: string;
  filePath?: string;
  buffer?: Buffer;
  base64?: string;
};

type TestAssetsFixture = {
  resolve: (assetIds: string[]) => Promise<Map<string, ResolvedAsset>>;
  resolveAsBuffer: (assetId: string) => Promise<ResolvedAsset & { buffer: Buffer }>;
  resolveAsBase64: (assetId: string) => Promise<ResolvedAsset & { base64: string }>;
  resolvePack: (packId: string) => Promise<Map<string, ResolvedAsset>>;
  resolveAsFile: (assetId: string) => Promise<ResolvedAsset & { filePath: string }>;
};

/**
 * Test Assets Fixture
 *
 * Resolves test data assets by ID from the Test Data Hub API.
 * Assets can be returned as:
 * - file (temporary file on disk)
 * - buffer (in-memory Buffer)
 * - base64 (Base64 encoded string)
 *
 * Usage:
 *   const assets = await testAssets.resolve(["asset_finger_right_index_001"]);
 *   const finger = assets.get("asset_finger_right_index_001");
 *   await page.getByTestId("upload").setInputFiles(finger.filePath);
 *
 * For Playwright upload with buffer:
 *   const asset = await testAssets.resolveAsBuffer("asset_001");
 *   await page.getByTestId("upload").setInputFiles({
 *     name: asset.key + ".bin",
 *     mimeType: asset.mimeType,
 *     buffer: asset.buffer,
 *   });
 *
 * For API multipart with buffer:
 *   const asset = await testAssets.resolveAsBuffer("asset_001");
 *   await request.post("/api/upload", {
 *     multipart: {
 *       file: {
 *         name: asset.key,
 *         mimeType: asset.mimeType,
 *         buffer: asset.buffer,
 *       },
 *     },
 *   });
 *
 * For API Base64:
 *   const asset = await testAssets.resolveAsBase64("asset_001");
 *   await request.post("/api/biometrics/base64", {
 *     data: {
 *       mimeType: asset.mimeType,
 *       base64: asset.base64,
 *     },
 *   });
 *
 * For test data packs (multiple assets with roles):
 *   const pack = await testAssets.resolvePack("pack_biometria_completa_001");
 *   await biometricPage.uploadFinger("right-index", pack.get("right_index").filePath);
 */
export const test = base.extend<{ testAssets: TestAssetsFixture }>({
  testAssets: async ({ request }, provideFixture) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tc-assets-"));

    /**
     * Resolve multiple assets by ID, returning as temporary files on disk
     */
    async function resolve(assetIds: string[]): Promise<Map<string, ResolvedAsset>> {
      const response = await request.post("/api/test-data-assets/resolve", {
        data: {
          assetIds,
          format: "file",
          purpose: "playwright",
        },
      });

      if (!response.ok()) {
        throw new Error(`Failed to resolve assets: ${response.status()}`);
      }

      const payload = await response.json();
      const result = new Map<string, ResolvedAsset>();

      for (const item of payload.assets) {
        const fileResponse = await request.get(item.downloadUrl);

        if (!fileResponse.ok()) {
          throw new Error(`Failed to download asset ${item.assetId}: ${fileResponse.status()}`);
        }

        const buffer = await fileResponse.body();
        const fileName = item.fileName ?? `${item.key}.bin`;
        const filePath = path.join(tempDir, fileName);

        await fs.writeFile(filePath, buffer);

        result.set(item.assetId, {
          assetId: item.assetId,
          key: item.key,
          mimeType: item.mimeType,
          filePath,
          buffer,
        });
      }

      return result;
    }

    /**
     * Resolve a single asset as a Buffer (in-memory)
     * Useful for Playwright's setInputFiles with buffer or API multipart
     */
    async function resolveAsBuffer(assetId: string): Promise<ResolvedAsset & { buffer: Buffer }> {
      const assets = await resolve([assetId]);
      const asset = assets.get(assetId);

      if (!asset?.buffer) {
        throw new Error(`Asset not found or no buffer: ${assetId}`);
      }

      return asset as ResolvedAsset & { buffer: Buffer };
    }

    /**
     * Resolve a single asset as Base64 (encoded string)
     * Useful for API Base64 payloads
     */
    async function resolveAsBase64(assetId: string): Promise<ResolvedAsset & { base64: string }> {
      const response = await request.post("/api/test-data-assets/resolve", {
        data: {
          assetIds: [assetId],
          format: "base64",
          purpose: "playwright",
        },
      });

      if (!response.ok()) {
        throw new Error(`Failed to resolve Base64: ${response.status()}`);
      }

      const payload = await response.json();
      const item = payload.assets[0];

      if (!item) {
        throw new Error(`Asset not found: ${assetId}`);
      }

      return {
        assetId: item.assetId,
        key: item.key,
        mimeType: item.mimeType,
        base64: item.base64,
      };
    }

    /**
     * Resolve a test data pack by ID
     * Returns a map of assets with role-based keys
     * Example: pack.get("right_index") for biometric role mapping
     */
    async function resolvePack(packId: string): Promise<Map<string, ResolvedAsset>> {
      const response = await request.post("/api/test-data-packs/resolve", {
        data: {
          packId,
          format: "file",
          purpose: "playwright",
        },
      });

      if (!response.ok()) {
        throw new Error(`Failed to resolve pack: ${response.status()}`);
      }

      const payload = await response.json();
      const result = new Map<string, ResolvedAsset>();

      for (const item of payload.assets) {
        const fileResponse = await request.get(item.downloadUrl);

        if (!fileResponse.ok()) {
          throw new Error(`Failed to download pack asset ${item.assetId}: ${fileResponse.status()}`);
        }

        const buffer = await fileResponse.body();
        const fileName = item.fileName ?? `${item.key}.bin`;
        const filePath = path.join(tempDir, fileName);

        await fs.writeFile(filePath, buffer);

        // Use the role as the key in the map for easy access
        const mapKey = item.role || item.key;

        result.set(mapKey, {
          assetId: item.assetId,
          key: item.key,
          mimeType: item.mimeType,
          filePath,
          buffer,
        });
      }

      return result;
    }

    /**
     * Resolve a single asset as file (temporary on disk)
     * Explicitly ensures file path is available
     */
    async function resolveAsFile(assetId: string): Promise<ResolvedAsset & { filePath: string }> {
      const assets = await resolve([assetId]);
      const asset = assets.get(assetId);

      if (!asset?.filePath) {
        throw new Error(`Asset file path not available: ${assetId}`);
      }

      return asset as ResolvedAsset & { filePath: string };
    }

    await provideFixture({
      resolve,
      resolveAsBuffer,
      resolveAsBase64,
      resolvePack,
      resolveAsFile,
    });

    // Cleanup temporary files
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
      // ignore cleanup errors
    });
  },
});

export { expect } from "@playwright/test";

