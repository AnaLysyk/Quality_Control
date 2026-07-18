import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import { prisma } from "@/database/prismaClient";
import { canAccessCompany, canDeleteAsset, PermissionError } from "@/backend/test-data-hub/permissions";

/**
 * GET /api/test-data-assets/:id
 *
 * Get a single test data asset by ID.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assetId } = await params;

    const asset = await prisma.testDataAsset.findUnique({
      where: { id: assetId },
      include: {
        usagePolicy: true,
        caseLinks: {
          select: {
            id: true,
            testCaseId: true,
            stepId: true,
            usage: true,
            variableName: true,
          },
        },
        packItems: {
          select: {
            id: true,
            packId: true,
            role: true,
            order: true,
          },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Verify user has permission to view this asset
    if (!canAccessCompany(user, asset.companySlug)) {
      return NextResponse.json({ error: "No access to this asset" }, { status: 403 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error("[test-data-assets/:id GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/test-data-assets/:id
 *
 * Update a test data asset.
 *
 * Request body (all fields optional):
 * {
 *   "label": "Updated label",
 *   "status": "active" | "outdated" | "deprecated",
 *   "sensitivity": "public" | "internal" | "restricted" | "sensitive",
 *   "metadata": {}
 * }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assetId } = await params;
    const body = await request.json();
    const { label, status, sensitivity, metadata } = body;

    // Find existing asset
    const existing = await prisma.testDataAsset.findUnique({
      where: { id: assetId },
      select: { id: true, companySlug: true, sensitivity: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Verify user has permission to update this asset
    if (!canAccessCompany(user, existing.companySlug)) {
      return NextResponse.json({ error: "No permission to update this asset" }, { status: 403 });
    }

    // Update asset
    const updated = await prisma.testDataAsset.update({
      where: { id: assetId },
      data: {
        ...(label && { label }),
        ...(status && { status }),
        ...(sensitivity && { sensitivity }),
        ...(metadata && { metadata }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        key: true,
        label: true,
        assetType: true,
        mimeType: true,
        sensitivity: true,
        status: true,
        updatedAt: true,
      },
    });

    // Log asset update to audit table
    await prisma.testDataAssetAudit.create({
      data: {
        assetId,
        action: "updated",
        actorUserId: user.id,
        companySlug: existing.companySlug,
        metadata: {
          changedFields: {
            label: label ? "changed" : null,
            status: status ? "changed" : null,
            sensitivity: sensitivity ? "changed" : null,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[test-data-assets/:id PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/test-data-assets/:id
 *
 * Delete a test data asset.
 *
 * Cannot delete if asset is in use (linked to cases or packs).
 * Use PATCH to archive instead.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assetId } = await params;

    // Find existing asset
    const existing = await prisma.testDataAsset.findUnique({
      where: { id: assetId },
      select: { id: true, companySlug: true, sensitivity: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Verify user has permission to delete this asset
    if (!canDeleteAsset(user, existing.companySlug, existing.sensitivity)) {
      return NextResponse.json(
        { error: "No permission to delete this asset" },
        { status: 403 },
      );
    }

    // Check for active links
    const links = await prisma.testCaseAssetLink.count({
      where: { assetId },
    });

    const packItems = await prisma.testDataPackItem.count({
      where: { assetId },
    });

    if (links > 0 || packItems > 0) {
      return NextResponse.json(
        { error: "Cannot delete asset with active links. Archive it instead." },
        { status: 409 },
      );
    }

    // Delete asset
    await prisma.testDataAsset.delete({
      where: { id: assetId },
    });

    // Log asset deletion to audit table
    await prisma.testDataAssetAudit.create({
      data: {
        assetId,
        action: "deleted",
        actorUserId: user.id,
        companySlug: existing.companySlug,
      },
    });

    return NextResponse.json({ message: "Asset deleted" });
  } catch (error) {
    console.error("[test-data-assets/:id DELETE]", error);

    if ((error as any).code === "P2025") {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

