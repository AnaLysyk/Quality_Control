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
  TEST_DATA_DOWNLOAD_PURPOSES,
  type TestDataDownloadPurpose,
  verifyTestDataDownloadToken,
} from "@/backend/test-data-hub/downloadToken";

/**
 * GET /api/test-data-assets/:id/content
 *
 * Download the content of a test data asset.
 *
 * Query parameters:
 * - purpose: "playwright" | "test_execution" | "documentation"
 * - expires: Unix timestamp of expiration (milliseconds)
 *
 * Response: Binary file content with appropriate Content-Type header
 *
 * Security:
 * - User must be authenticated
 * - Download URL must not be expired
 * - User must have permission to access the asset
 * - All downloads are logged to TestDataAssetAudit
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assetId } = await params;
    const { searchParams } = new URL(request.url);
    const purpose = (searchParams.get("purpose") || "test_execution") as TestDataDownloadPurpose;
    if (!TEST_DATA_DOWNLOAD_PURPOSES.includes(purpose)) {
      return NextResponse.json({ error: "Invalid download purpose" }, { status: 400 });
    }

    const tokenResult = verifyTestDataDownloadToken(searchParams.get("token"), {
      assetId,
      userId: user.id,
      purpose,
    });
    if (!tokenResult.valid) {
      return NextResponse.json({ error: tokenResult.reason }, { status: 403 });
    }

    // Fetch asset from database
    const asset = await prisma.testDataAsset.findUnique({
      where: { id: assetId },
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
            allowReportContent: true,
          },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Check asset status
    if (asset.status !== "active") {
      return NextResponse.json({ error: "Asset is not active" }, { status: 410 });
    }

    if (
      !canAccessProject(user, asset.companySlug, asset.projectId) ||
      !canAccessSensitivity(user, asset.sensitivity) ||
      !canViewBase64(user, asset.companySlug, asset.sensitivity)
    ) {
      return NextResponse.json({ error: "Asset not found or unavailable" }, { status: 404 });
    }

    const policyUsage =
      purpose === "playwright"
        ? "playwright_upload"
        : purpose === "documentation"
          ? "report_content"
          : "api_multipart";
    if (!UsagePolicyValidator.validateUsage(asset.usagePolicy, policyUsage).allowed) {
      return NextResponse.json({ error: "Asset usage is not allowed for this purpose" }, { status: 403 });
    }

    let contentBuffer: Buffer;

    // Get file content
    if (asset.encoding === "base64" && asset.base64Value) {
      // Convert Base64 to Buffer
      contentBuffer = Buffer.from(asset.base64Value, "base64");
    } else if (asset.storagePath) {
      // TODO: Implement S3 or other storage backend
      // For now, return placeholder
      return NextResponse.json(
        { error: "File storage not yet implemented" },
        { status: 501 },
      );
    } else {
      return NextResponse.json({ error: "Asset has no content" }, { status: 410 });
    }

    await prisma.testDataAssetAudit.create({
      data: {
        assetId: asset.id,
        action: `downloaded_for_${purpose}`,
        actorUserId: user.id,
        companySlug: asset.companySlug,
        projectId: asset.projectId,
        metadata: { tokenExpiresAt: new Date(tokenResult.expiresAt).toISOString() },
      },
    });

    // Return file with appropriate headers
    const safeFileName = asset.key.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "test-data-asset";
    return new NextResponse(new Uint8Array(contentBuffer), {
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFileName}.bin"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("[test-data-assets/:id/content]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
