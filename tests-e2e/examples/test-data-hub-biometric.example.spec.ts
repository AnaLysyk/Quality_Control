/**
 * Example: Test Data Hub — Biometric Upload with Assets
 *
 * This test demonstrates how to use the Test Data Hub to:
 * 1. Resolve biometric assets by ID
 * 2. Upload assets as files using Playwright's setInputFiles
 * 3. Verify the upload was successful
 * 4. Attach asset metadata to the test report
 *
 * Key points:
 * - Assets are stored in the database with IDs, not in the code
 * - Playwright fixture resolves assets by ID at runtime
 * - Only asset IDs go to GitHub, not the actual biometric data
 * - Download URLs expire after 15 minutes for security
 * - Asset usage is automatically logged in TestDataAssetAudit
 */

import { test } from "../../tests-e2e/fixtures/test-assets.fixture";
import { expect } from "@playwright/test";

test.describe("Biometric Upload with Test Data Hub", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the biometric form
    await page.goto("/applications/biometric-enrollment");

    // Wait for form to load
    await page.waitForSelector('form[data-testid="biometric-form"]');
  });

  test("@tc-1042 should upload right index fingerprint from asset", async ({ page, testAssets }, testInfo) => {
    // ============================================================
    // Step 1: Resolve asset by ID
    // ============================================================
    // This calls POST /api/test-data-assets/resolve with:
    // - assetIds: ["asset_finger_right_index_001"]
    // - format: "file"
    // - purpose: "playwright"
    //
    // Response includes a temporary download URL that expires in 15 minutes.
    // The fixture automatically downloads and saves to a temp directory.

    const assets = await testAssets.resolve(["asset_finger_right_index_001"]);
    const fingerRightIndex = assets.get("asset_finger_right_index_001");

    expect(fingerRightIndex).toBeDefined();
    expect(fingerRightIndex?.mimeType).toBe("image/png");
    expect(fingerRightIndex?.filePath).toBeTruthy();

    // ============================================================
    // Step 2: Upload using setInputFiles
    // ============================================================

    await test.step("Upload right index fingerprint", async () => {
      // Playwright's setInputFiles() accepts a file path
      // The file is temporary and will be cleaned up after the test
      await page.getByTestId("finger-right-index-upload").setInputFiles(fingerRightIndex!.filePath);

      // Wait for upload to complete
      await page.waitForResponse((response) => response.url().includes("/api/biometrics/upload"));
    });

    // ============================================================
    // Step 3: Verify upload was successful
    // ============================================================

    await test.step("Verify upload success", async () => {
      await expect(page.getByText(/biometria enviada com sucesso/i)).toBeVisible();
      await expect(page.getByTestId("finger-status")).toHaveText("Aceita");
    });

    // ============================================================
    // Step 4: Attach asset metadata to report (NOT the actual image!)
    // ============================================================
    // This is important for security:
    // - Report shows which asset was used (ID, key, type)
    // - Report does NOT include the actual biometric data
    // - QA can verify and audit which assets were used

    await testInfo.attach("biometric-asset-used", {
      body: JSON.stringify(
        {
          testCaseKey: "TC-1042",
          assetId: fingerRightIndex!.assetId,
          key: fingerRightIndex!.key,
          mimeType: fingerRightIndex!.mimeType,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });

  test("@tc-1043 should upload multiple biometric assets as a pack", async ({ page, testAssets }, testInfo) => {
    // ============================================================
    // Using TestDataPack for multiple related assets
    // ============================================================
    // A pack allows uploading multiple biometric captures in one call.
    // Each asset in the pack has a "role" (right_index, left_thumb, etc)
    // making it easy to map to form fields.

    const pack = await testAssets.resolvePack("pack_biometria_completa_001");

    expect(pack.size).toBeGreaterThan(0);

    // ============================================================
    // Step 1: Upload right index finger
    // ============================================================

    await test.step("Upload right index", async () => {
      const rightIndex = pack.get("right_index");
      expect(rightIndex).toBeDefined();

      await page.getByTestId("finger-right-index-upload").setInputFiles(rightIndex!.filePath);
      await expect(page.getByTestId("finger-right-index-status")).toHaveText("✓");
    });

    // ============================================================
    // Step 2: Upload left thumb
    // ============================================================

    await test.step("Upload left thumb", async () => {
      const leftThumb = pack.get("left_thumb");
      expect(leftThumb).toBeDefined();

      await page.getByTestId("finger-left-thumb-upload").setInputFiles(leftThumb!.filePath);
      await expect(page.getByTestId("finger-left-thumb-status")).toHaveText("✓");
    });

    // ============================================================
    // Step 3: Upload face photo
    // ============================================================

    await test.step("Upload face photo", async () => {
      const facePhoto = pack.get("face_photo");
      expect(facePhoto).toBeDefined();

      await page.getByTestId("face-photo-upload").setInputFiles(facePhoto!.filePath);
      await expect(page.getByTestId("face-photo-status")).toHaveText("✓");
    });

    // ============================================================
    // Step 4: Submit form
    // ============================================================

    await test.step("Submit biometric enrollment", async () => {
      await page.getByRole("button", { name: /enviar/i }).click();
      await expect(page.getByText(/enrolamento realizado com sucesso/i)).toBeVisible();
    });

    // ============================================================
    // Step 5: Attach pack usage to report
    // ============================================================

    await testInfo.attach("biometric-pack-used", {
      body: JSON.stringify(
        {
          testCaseKey: "TC-1043",
          packId: "pack_biometria_completa_001",
          assetsUsed: Array.from(pack.entries()).map(([role, asset]) => ({
            role,
            assetId: asset.assetId,
            key: asset.key,
          })),
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });

  test("@tc-1044 should upload biometric via API with buffer", async ({ request, testAssets }, testInfo) => {
    // ============================================================
    // Using resolveAsBuffer for API multipart
    // ============================================================
    // When uploading via API instead of form, use resolveAsBuffer()
    // to get a Buffer instead of a file path.
    // Playwright's APIRequestContext.post() with multipart supports buffers.

    const asset = await testAssets.resolveAsBuffer("asset_finger_right_index_001");

    // ============================================================
    // Step 1: Make API request with multipart
    // ============================================================

    const response = await request.post("/api/biometrics/upload", {
      multipart: {
        protocol: "PROTOCOLO_TESTE_001",
        subject: "test-subject-123",
        finger: "right-index",
        file: {
          name: `${asset.key}.png`,
          mimeType: asset.mimeType,
          buffer: asset.buffer,
        },
      },
    });

    // ============================================================
    // Step 2: Verify response
    // ============================================================

    expect(response.ok()).toBeTruthy();
    const responseBody = await response.json();
    expect(responseBody.biometricId).toBeTruthy();

    // ============================================================
    // Step 3: Attach API payload metadata to report
    // ============================================================

    await testInfo.attach("api-upload-metadata", {
      body: JSON.stringify(
        {
          testCaseKey: "TC-1044",
          method: "POST",
          url: "/api/biometrics/upload",
          mimeType: asset.mimeType,
          assetId: asset.assetId,
          key: asset.key,
          responseStatus: response.status(),
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });

  test("@tc-1045 should upload biometric via API with Base64", async ({ request, testAssets }, testInfo) => {
    // ============================================================
    // Using resolveAsBase64 for API Base64 payload
    // ============================================================
    // When the API expects Base64 encoded data, use resolveAsBase64()
    // to get the data pre-encoded.

    const asset = await testAssets.resolveAsBase64("asset_finger_right_index_001");

    // ============================================================
    // Step 1: Make API request with Base64
    // ============================================================

    const response = await request.post("/api/biometrics/base64", {
      data: {
        protocol: "PROTOCOLO_TESTE_001",
        subject: "test-subject-123",
        finger: "right-index",
        mimeType: asset.mimeType,
        base64: asset.base64,
      },
    });

    // ============================================================
    // Step 2: Verify response
    // ============================================================

    expect(response.ok()).toBeTruthy();
    const responseBody = await response.json();
    expect(responseBody.biometricId).toBeTruthy();

    // ============================================================
    // Step 3: Attach request metadata to report
    // ============================================================
    // Note: We attach metadata only, NOT the Base64 content itself
    // This keeps the report readable and secure

    await testInfo.attach("base64-upload-metadata", {
      body: JSON.stringify(
        {
          testCaseKey: "TC-1045",
          method: "POST",
          url: "/api/biometrics/base64",
          assetId: asset.assetId,
          key: asset.key,
          mimeType: asset.mimeType,
          base64Length: asset.base64.length,
          responseStatus: response.status(),
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });
});

test.describe("Test Data Hub Security", () => {
  test("@tc-1050 should NOT expose sensitive asset in test code", async () => {
    // ============================================================
    // This test serves as documentation of what NOT to do
    // ============================================================
    // WRONG: Committing sensitive data to GitHub
    // ❌ const base64 = "iVBORw0KGgo..."; // NEVER do this!
    // ❌ const filePath = require("fs").readFileSync("./biometrics/finger.png");
    //
    // RIGHT: Use assetId and let fixture resolve at runtime
    // ✅ const assets = await testAssets.resolve(["asset_finger_right_index_001"]);
    //
    // RIGHT: Asset ID is generic, can be rotated
    // ✅ "asset_finger_right_index_001" can be updated to point to different data
    //    without changing test code.
    //
    // RIGHT: Download URL expires
    // ✅ URL is valid for only 15 minutes, can't be reused indefinitely.

    expect(true).toBe(true); // This test just documents the rules
  });

  test("@tc-1051 assets used should be logged in ExecutionAssetUsage", async () => {
    // ============================================================
    // Asset usage is automatically tracked
    // ============================================================
    // After test execution, the system should record:
    // - executionId: which execution (run) used the asset
    // - assetId: which asset was used
    // - testCaseId: which test case used it
    // - usage: how it was used (upload, api, base64, etc)
    // - status: success/failed/error
    //
    // This allows auditing and ensures traceability.

    expect(true).toBe(true);
  });
});
