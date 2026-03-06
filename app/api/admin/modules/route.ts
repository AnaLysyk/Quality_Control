import { NextResponse } from 'next/server';
import MODULES from '../../../../src/lib/modules';

export async function GET() {
  return NextResponse.json({ items: MODULES });
}
