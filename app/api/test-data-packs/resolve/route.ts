import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { prisma } from "@/database/prismaClient";
import {
  canAccessProject,
  canAccessSensitivity,
  canViewBase64,
} from "@/backend/test-data-hub/permissions";
import { UsagePolicyValidator } from "@/backend/test-data-hub/guardrails";
import {
  createTestDataDownloadToken,
  TEST_DATA_DOWNLOAD_PURPOSES,
  type TestDataDownloadPurpose,
} from "@/backend/test-data-hub/downloadToken";

/**
 * POST /api/test-data-packs/resolve
 *
 * Resolve a test data pack (collection of related assets) by ID.
 *
 * Request body:
 * {
 *   "packId": "pack_biometria_completa_001",
 *   "format": "file" | "base64",  // default: "file"
 *   "purpose": "playwright" | "test_execution" | "documentation"
 * }
 *
 * Response (format: "file"):
 * {
 *   "assets": [
 *     {
 *       "assetId": "asset_001",
 *       "key": "fingerRightIndex",
 *       "role": "right_index",
 *       "mimeType": "image/png",
 *       "fileName": "finger-right-index.png",
 *       "downloadUrl": "/api/test-data-assets/asset_001/content?token=...",
 *       "expiresAt": "2026-05-09T15:30:00Z"
 *     }
 *   ]
 * }
 *
 * The "role" field allows mapping assets by their semantic role in the pack.
 * For example: right_index, left_thumb, face_photo, etc.
 *
 * Usage in Playwright:
 *   const pack = await testAssets.resolvePack("pack_biometria_001");
 *   await page.getByTestId("right-index").setInputFiles(pack.get("right_index").filePath);
 *   await page.getByTestId("left-thumb").setInputFiles(pack.get("left_thumb").filePath);
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { packId, format = "file", purpose: rawPurpose = "test_execution" } = body;
    const purpose = rawPurpose as TestDataDownloadPurpose;

    // Validate request
    if (!packId || typeof packId !== "string") {
      return NextResponse.json({ error: "packId is required and must be a string" }, { status: 400 });
    }

    if (!["file", "base64"].includes(format)) {
      return NextResponse.json({ error: 'format must be "file" or "base64"' }, { status: 400 });
    }

    if (!TEST_DATA_DOWNLOAD_PURPOSES.includes(purpose)) {
      return NextResponse.json({ error: 'purpose must be "playwright", "test_execution", or "documentation"' }, { status: 400 });
    }

    // Fetch pack with all items and their assets
    const pack = await prisma.testDataPack.findUnique({
      where: { id: packId },
      include: {
        items: {
          include: {
            asset: {
              select: {
                id: true,
                key: true,
                label: true,
                mimeType: true,
                encoding: true,
                base64Value: true,
                storagePath: true,
                sensitivity: true,
                status: true,
                companySlug: true,
                projectId: true,
                usagePolicy: {
                  select: {
                    allowPlaywrightUpload: true,
                    allowApiMultipart: true,
                    allowBase64Api: true,
                    allowReportContent: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!pack) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    // Check pack status
    if (pack.status !== "active") {
      return NextResponse.json({ error: "Pack is not active" }, { status: 410 });
    }

    if (pack.items.length === 0) {
      return NextResponse.json({ error: "Pack has no items" }, { status: 400 });
    }

    if (
      !canAccessProject(user, pack.companySlug, pack.projectId) ||
      !canAccessSensitivity(user, pack.sensitivity)
    ) {
      return NextResponse.json({ error: "Pack not found or unavailable" }, { status: 404 });
    }

    // Validate format compatibility with each asset's usage policy
    for (const item of pack.items) {
      const asset = item.asset;
      const policy = asset.usagePolicy;

      const sameTenant = asset.companySlug === pack.companySlug;
      const compatibleProject = !asset.projectId || !pack.projectId || asset.projectId === pack.projectId;
      if (
        asset.status !== "active" ||
        !sameTenant ||
        !compatibleProject ||
        !canAccessProject(user, asset.companySlug, asset.projectId) ||
        !canAccessSensitivity(user, asset.sensitivity)
      ) {
        return NextResponse.json({ error: "Pack contains an unavailable asset" }, { status: 403 });
      }

      if (format === "base64" && !canViewBase64(user, asset.companySlug, asset.sensitivity)) {
        return NextResponse.json({ error: "Pack contains an asset unavailable as Base64" }, { status: 403 });
      }

      if (format === "base64" && !UsagePolicyValidator.validateUsage(policy, "api_base64").allowed) {
        return NextResponse.json(
          { error: `Asset ${asset.id} in pack cannot be returned as Base64` },
          { status: 403 },
        );
      }

      const fileUsage = purpose === "playwright"
        ? "playwright_upload"
        : purpose === "documentation"
          ? "report_content"
          : "api_multipart";
      if (format === "file" && !UsagePolicyValidator.validateUsage(policy, fileUsage).allowed) {
        return NextResponse.json(
          { error: `Asset ${asset.id} in pack cannot be returned as file` },
          { status: 403 },
        );
      }
    }

    // Build response based on format
    let responseData: any;

    if (format === "base64") {
      responseData = {
        assets: pack.items.map((item) => {
          const asset = item.asset;

          if (!asset.base64Value) {
            throw new Error(`Asset ${asset.id} has no Base64 value`);
          }

          return {
            assetId: asset.id,
            key: asset.key,
            role: item.role,
            mimeType: asset.mimeType,
            encoding: "base64",
            base64: asset.base64Value,
            sensitivity: asset.sensitivity,
          };
        }),
      };
    } else {
      // format === "file"
      const expirationMinutes = 15;
      const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

      responseData = {
        assets: pack.items.map((item) => {
          const asset = item.asset;

          // Generate temporary download URL
          const token = createTestDataDownloadToken({
            assetId: asset.id,
            userId: user.id,
            purpose,
            expiresAt: expiresAt.getTime(),
          });
          const downloadUrl = `/api/test-data-assets/${asset.id}/content?purpose=${purpose}&token=${encodeURIComponent(token)}`;

          return {
            assetId: asset.id,
            key: asset.key,
            role: item.role,
            mimeType: asset.mimeType,
            fileName: `${asset.key}.${getMimeExtension(asset.mimeType)}`,
            downloadUrl,
            expiresAt: expiresAt.toISOString(),
            sensitivity: asset.sensitivity,
          };
        }),
      };
    }

    await Promise.all(
      pack.items.map((item) =>
        prisma.testDataAssetAudit.create({
          data: {
            assetId: item.asset.id,
            action: format === "base64" ? "pack_resolved_as_base64" : "pack_resolved_as_file",
            actorUserId: user.id,
            companySlug: item.asset.companySlug,
            projectId: item.asset.projectId,
            metadata: { packId: pack.id, purpose, format },
          },
        }),
      ),
    );

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[test-data-packs/resolve]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Get file extension from MIME type
 */
function getMimeExtension(mimeType: string | null): string {
  if (!mimeType) return "bin";

  const mimeMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "application/json": "json",
    "application/octet-stream": "bin",
  };

  return mimeMap[mimeType] || "bin";
}
