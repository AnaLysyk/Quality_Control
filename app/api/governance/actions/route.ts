import { NextResponse } from 'next/server';

type Action = {
  id: string;
  companyId: string;
  type: string;
  note?: string;
  createdAt: string;
};

// simple in-memory store for dev/demo purposes
const ACTIONS: Action[] = [];

export async function GET() {
  return NextResponse.json({ success: true, data: ACTIONS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const a: Action = {
      id: `act_${Date.now()}`,
      companyId: body.companyId,
      type: body.type || 'manual_action',
      note: body.note || '',
      createdAt: new Date().toISOString(),
    };
    ACTIONS.push(a);
    return NextResponse.json({ success: true, data: a }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: { message: 'invalid payload' } }, { status: 400 });
  }
}
