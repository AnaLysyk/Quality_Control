import { NextResponse } from 'next/server';
import { getModulesCatalog } from '../../../../src/lib/store/modulesStore';

export async function GET() {
  try {
    const modules = await getModulesCatalog();
    return NextResponse.json({ modules });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
 
