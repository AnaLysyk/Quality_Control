import { NextResponse, NextRequest } from 'next/server';
import { getUserOverride, setUserOverride } from '../../../../../../src/lib/store/permissionsStore';
import { ROLE_DEFAULTS } from '../../../../../../src/lib/permissions/roleDefaults';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await params;
    const userId = p.id;
    // In a real app you'd fetch the user and role; for prototype assume role in query or default to 'user'
    const role = 'user';
    const override = await getUserOverride(userId);
    const roleDefaults = (ROLE_DEFAULTS as any)[role] || {};
    return NextResponse.json({ userId, role, roleDefaults, override });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await params;
    const userId = p.id;
    const body = await req.json();
    const allowed = body.allow ?? undefined;
    const deny = body.deny ?? undefined;
    const saved = await setUserOverride(userId, { allow: allowed, deny });
    return NextResponse.json({ ok: true, saved });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

