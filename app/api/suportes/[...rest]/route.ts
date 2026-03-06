// Catch-all compatibility proxy: forward any subpath under /api/suportes/*
// to /api/tickets/* to maintain backward compatibility for older clients.
async function proxy(req: Request) {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  // Replace only the first occurrence of /api/suportes with /api/tickets
  const targetPath = req.url.replace('/api/suportes', '/api/tickets');
  const target = new URL(targetPath, origin).toString();

  const init: RequestInit = {
    method: req.method,
    headers: req.headers as any,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE') {
    init.body = await req.text();
  }

  const res = await fetch(target, init);
  const body = await res.arrayBuffer();
  return new Response(body, { status: res.status, headers: res.headers });
}

export async function GET(req: Request) {
  return proxy(req);
}

export async function POST(req: Request) {
  return proxy(req);
}

export async function PATCH(req: Request) {
  return proxy(req);
}

export async function PUT(req: Request) {
  return proxy(req);
}

export async function DELETE(req: Request) {
  return proxy(req);
}
