import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { prisma } from "@/lib/prismaClient";
import {
  canAccessCompany,
  canAccessSensitivity,
  canCreateAsset,
  PermissionError,
} from "@/lib/test-data-hub/permissions";

/**
 * GET /api/test-data-assets
 *
 * List test data assets with optional filtering.
 *
 * Query parameters:
 * - companySlug: string (required for non-admin)
 * - projectId: string (optional)
 * - assetType: string (optional)
 * - sensitivity: string (optional)
 * - status: string (optional, default: "active")
 * - skip: number (default: 0)
 * - take: number (default: 20, max: 100)
 * - search: string (optional, searches in key and label)
 *
 * Response:
 * {
 *   "assets": [...],
 *   "total": number,
 *   "skip": number,
 *   "take": number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companySlug = searchParams.get("companySlug");
    const projectId = searchParams.get("projectId");
    const assetType = searchParams.get("assetType");
    const sensitivity = searchParams.get("sensitivity");
    const status = searchParams.get("status") || "active";
    const skip = Math.max(0, parseInt(searchParams.get("skip") || "0", 10));
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get("take") || "20", 10)));
    const search = searchParams.get("search");

    if (!companySlug) {
      return NextResponse.json({ error: "companySlug is required" }, { status: 400 });
    }

    // Verify user has permission to access this company
    if (!canAccessCompany(user, companySlug)) {
      return NextResponse.json({ error: "No access to this company" }, { status: 403 });
    }

    // Build where clause
    const where: any = {
      companySlug,
      status,
    };

    if (projectId) {
      where.projectId = projectId;
    }

    if (assetType) {
      where.assetType = assetType;
    }

    if (sensitivity) {
      // If user specified sensitivity, verify they can access it
      if (!canAccessSensitivity(user, sensitivity)) {
        return NextResponse.json(
          { error: `No permission to access sensitivity level: ${sensitivity}` },
          { status: 403 },
        );
      }
      where.sensitivity = sensitivity;
    } else {
      // If no sensitivity filter, only return assets user can access
      const accessibleSensitivities = ["public"];
      if (canAccessSensitivity(user, "internal")) accessibleSensitivities.push("internal");
      if (canAccessSensitivity(user, "restricted")) accessibleSensitivities.push("restricted");
      if (canAccessSensitivity(user, "sensitive")) accessibleSensitivities.push("sensitive");

      where.sensitivity = {
        in: accessibleSensitivities,
      };
    }

    if (search) {
      where.OR = [{ key: { contains: search, mode: "insensitive" } }, { label: { contains: search, mode: "insensitive" } }];
    }

    const [assets, total] = await Promise.all([
      prisma.testDataAsset.findMany({
        where,
        select: {
          id: true,
          key: true,
          label: true,
          assetType: true,
          mimeType: true,
          sensitivity: true,
          status: true,
          sizeBytes: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.testDataAsset.count({ where }),
    ]);

    return NextResponse.json({
      assets,
      total,
      skip,
      take,
    });
  } catch (error) {
    console.error("[test-data-assets GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/test-data-assets
 *
 * Create a new test data asset.
 *
 * Request body:
 * {
 *   "companySlug": "griaule",
 *   "projectId": "proj_123",
 *   "documentId": "doc_123" (optional),
 *   "fragmentId": "frag_123" (optional),
 *   "key": "asset_finger_right_index_001",
 *   "label": "Indicador direito",
 *   "assetType": "biometric_image",
 *   "mimeType": "image/png",
 *   "encoding": "file" | "base64",
 *   "base64Value": "..." (if encoding=base64),
 *   "storagePath": "..." (if encoding=file),
 *   "sensitivity": "public" | "internal" | "restricted" | "sensitive",
 *   "metadata": {}
 * }
 *
 * Response:
 * {
 *   "id": "asset_cuid",
 *   "key": "asset_finger_right_index_001",
 *   "label": "Indicador direito",
 *   ...
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { companySlug, projectId, documentId, fragmentId, key, label, assetType, mimeType, encoding, base64Value, storagePath, sensitivity = "internal", metadata } = body;

    // Validate required fields
    const errors = [];
    if (!companySlug) errors.push("companySlug is required");
    if (!key) errors.push("key is required");
    if (!label) errors.push("label is required");
    if (!assetType) errors.push("assetType is required");
    if (!encoding) errors.push("encoding is required");
    if (encoding === "base64" && !base64Value) errors.push("base64Value is required when encoding=base64");
    if (encoding === "file" && !storagePath) errors.push("storagePath is required when encoding=file");

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

    // Verify user has permission to create assets in this company
    if (!canCreateAsset(user, companySlug)) {
      return NextResponse.json(
        { error: "No permission to create assets in this company" },
        { status: 403 },
      );
    }

    // Check if key already exists
    const existing = await prisma.testDataAsset.findUnique({
      where: { key },
    });

    if (existing) {
      return NextResponse.json({ error: `Asset with key "${key}" already exists` }, { status: 409 });
    }

    // Calculate size if available
    let sizeBytes: number | null = null;
    let checksum: string | null = null;

    if (encoding === "base64" && base64Value) {
      sizeBytes = Buffer.from(base64Value, "base64").length;
      // TODO: Calculate checksum (SHA-256)
    }

    // Create asset
    const asset = await prisma.testDataAsset.create({
      data: {
        companySlug,
        projectId: projectId || null,
        documentId: documentId || null,
        fragmentId: fragmentId || null,
        key,
        label,
        assetType,
        mimeType: mimeType || null,
        encoding: encoding || null,
        base64Value: encoding === "base64" ? base64Value : null,
        storagePath: encoding === "file" ? storagePath : null,
        sensitivity,
        status: "active",
        sizeBytes,
        checksum,
        metadata: metadata || {},
        createdBy: user.id,
      },
      select: {
        id: true,
        key: true,
        label: true,
        assetType: true,
        mimeType: true,
        sensitivity: true,
        status: true,
        sizeBytes: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log asset creation to audit table
    await prisma.testDataAssetAudit.create({
      data: {
        assetId: asset.id,
        action: "created",
        actorUserId: user.id,
        companySlug,
        projectId: projectId || null,
        metadata: {
          key,
          assetType,
          sensitivity,
        },
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("[test-data-assets POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
