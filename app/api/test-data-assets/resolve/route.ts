import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { prisma } from "@/database/prismaClient";
import {
  canAccessCompany,
  canAccessSensitivity,
  canViewBase64,
  PermissionError,
} from "@/backend/test-data-hub/permissions";
import { RunnerAssetGuardrail, UsagePolicyValidator } from "@/backend/test-data-hub/guardrails";

/**
 * POST /api/test-data-assets/resolve
 *
 * Resolve test data assets by ID for Playwright test execution.
 *
 * This endpoint is called by the testAssets fixture in Playwright tests.
 * It returns asset metadata and download URLs (with temporary expiration).
 *
 * Request body:
 * {
 *   "assetIds": ["asset_001", "asset_002"],
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
 *       "mimeType": "image/png",
 *       "fileName": "finger-right-index.png",
 *       "downloadUrl": "/api/test-data-assets/asset_001/content?token=temporary",
 *       "expiresAt": "2026-05-09T15:30:00Z"
 *     }
 *   ]
 * }
 *
 * Response (format: "base64"):
 * {
 *   "assets": [
 *     {
 *       "assetId": "asset_001",
 *       "key": "fingerRightIndex",
 *       "mimeType": "image/png",
 *       "encoding": "base64",
 *       "base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
 *     }
 *   ]
 * }
 *
 * Security:
 * - User must be authenticated
 * - User must have access to the company/project where assets are stored
 * - Assets marked as sensitive (biometric, restricted) require elevated permissions
 * - Download URLs expire after 15 minutes
 * - All access is logged to TestDataAssetAudit
 *
 * Error responses:
 * - 401 Unauthorized: Not authenticated
 * - 403 Forbidden: No permission to access asset
 * - 404 Not Found: Asset not found
 * - 400 Bad Request: Invalid request parameters
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { assetIds, format = "file", purpose = "test_execution" } = body;

    // Validate request
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json({ error: "assetIds must be a non-empty array" }, { status: 400 });
    }

    if (!["file", "base64"].includes(format)) {
      return NextResponse.json({ error: 'format must be "file" or "base64"' }, { status: 400 });
    }

    if (!["playwright", "test_execution", "documentation"].includes(purpose)) {
      return NextResponse.json({ error: 'purpose must be "playwright", "test_execution", or "documentation"' }, { status: 400 });
    }

    // Fetch assets from database
    const assets = await prisma.testDataAsset.findMany({
      where: {
        id: {
          in: assetIds,
        },
      },
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
          },
        },
      },
    });

    // Check if all assets were found
    const notFoundIds = assetIds.filter((id) => !assets.find((a) => a.id === id));
    if (notFoundIds.length > 0) {
      return NextResponse.json({ error: `Assets not found: ${notFoundIds.join(", ")}` }, { status: 404 });
    }

    // Validate permissions for each asset
    const deniedAssets = [];

    for (const asset of assets) {
      // Check company access
      if (!canAccessCompany(user, asset.companySlug)) {
        deniedAssets.push({ assetId: asset.id, reason: "company_access" });
        continue;
      }

      // Check project access
      if (asset.projectId && !user.isGlobalAdmin && !user.companySlugs?.includes(asset.companySlug)) {
        deniedAssets.push({ assetId: asset.id, reason: "project_access" });
        continue;
      }

      // Check sensitivity access
      if (!canAccessSensitivity(user, asset.sensitivity)) {
        deniedAssets.push({ assetId: asset.id, reason: "sensitivity_level" });
        continue;
      }

      // For Base64, check additional permission
      if (format === "base64" && !canViewBase64(user, asset.companySlug, asset.sensitivity)) {
        deniedAssets.push({ assetId: asset.id, reason: "base64_access" });
        continue;
      }

      // Validate format compatibility with usage policy
      const policy = asset.usagePolicy;

      if (format === "base64") {
        const policyCheck = UsagePolicyValidator.validateUsage(policy, "api_base64");
        if (!policyCheck.allowed) {
          deniedAssets.push({ assetId: asset.id, reason: "policy_violation" });
          continue;
        }
      }

      if (format === "file") {
        const playgroundCheck = UsagePolicyValidator.validateUsage(policy, "playwright_upload");
        if (!playgroundCheck.allowed) {
          deniedAssets.push({ assetId: asset.id, reason: "policy_violation" });
        }
      }
    }

    // If any assets denied, return error
    if (deniedAssets.length > 0) {
      return NextResponse.json(
        { error: `Access denied to assets: ${deniedAssets.map((d) => d.assetId).join(", ")}` },
        { status: 403 },
      );
    }

    // All assets valid, build response
    let responseData: any;

    if (format === "base64") {
      responseData = {
        assets: assets.map((asset) => {
          if (!asset.base64Value) {
            throw new Error(`Asset ${asset.id} has no Base64 value`);
          }

          return {
            assetId: asset.id,
            key: asset.key,
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
        assets: assets.map((asset) => {
          // Generate temporary download URL
          // In production, this would include a signed token and expiration
          const downloadUrl = `/api/test-data-assets/${asset.id}/content?purpose=${purpose}&expires=${expiresAt.getTime()}`;

          return {
            assetId: asset.id,
            key: asset.key,
            mimeType: asset.mimeType,
            fileName: `${asset.key}.${getMimeExtension(asset.mimeType)}`,
            downloadUrl,
            expiresAt: expiresAt.toISOString(),
            sensitivity: asset.sensitivity,
          };
        }),
      };
    }

    // Log access to audit table
    for (const asset of assets) {
      await prisma.testDataAssetAudit.create({
        data: {
          assetId: asset.id,
          action: format === "base64" ? "resolved_as_base64" : "resolved_as_file",
          actorUserId: user.id,
          companySlug: asset.companySlug,
          projectId: asset.projectId,
          metadata: {
            purpose,
            format,
          },
        },
      });
    }

    return NextResponse.json(responseData);
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("[test-data-assets/resolve]", error);
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

