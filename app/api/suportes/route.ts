// Compatibility wrapper: proxy requests to /api/tickets to maintain backward compatibility
export async function GET(req: Request) {
	const url = new URL(req.url);
	const origin = `${url.protocol}//${url.host}`;
	const target = new URL(`/api/tickets${url.search}`, origin).toString();
	const res = await fetch(target, {
		method: "GET",
		headers: req.headers as any,
		cache: "no-store",
	});
	const body = await res.arrayBuffer();
	return new Response(body, { status: res.status, headers: res.headers });
}

export async function POST(req: Request) {
	const url = new URL(req.url);
	const origin = `${url.protocol}//${url.host}`;
	const target = new URL(`/api/tickets${url.search}`, origin).toString();
	const res = await fetch(target, {
		method: "POST",
		headers: req.headers as any,
		body: await req.text(),
	});
	const body = await res.arrayBuffer();
	return new Response(body, { status: res.status, headers: res.headers });
}
