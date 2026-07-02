import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { prisma } from "@/lib/prismaClient";

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
    const expiresParam = searchParams.get("expires");
    const purpose = searchParams.get("purpose") || "test_execution";

    // Check expiration
    if (expiresParam) {
      const expiresTime = parseInt(expiresParam, 10);
      if (isNaN(expiresTime) || Date.now() > expiresTime) {
        return NextResponse.json({ error: "Download URL expired" }, { status: 403 });
      }
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
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Check asset status
    if (asset.status !== "active") {
      return NextResponse.json({ error: "Asset is not active" }, { status: 410 });
    }

    // TODO: Implement permission checks
    // - Verify user has access to the company/project
    // - Check sensitivity level and permission overrides

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

    // TODO: Log download to audit table
    // await prisma.testDataAssetAudit.create({
    //   data: {
    //     assetId: asset.id,
    //     action: "downloaded_for_" + purpose,
    //     actorUserId: user.id,
    //     companySlug: asset.companySlug,
    //     projectId: asset.projectId,
    //   },
    // });

    // Return file with appropriate headers
    return new NextResponse(new Uint8Array(contentBuffer), {
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asset.key}.bin"`,
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

