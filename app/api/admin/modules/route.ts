import { NextResponse } from "next/server";
import { PERMISSION_MODULES } from "@/lib/permissionCatalog";

export const revalidate = 0;

export async function GET() {
  return NextResponse.json({ modules: PERMISSION_MODULES });
}
