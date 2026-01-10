// Default to non-mock supabase during tests; individual tests can enable it
process.env.SUPABASE_MOCK = process.env.SUPABASE_MOCK ?? "false";

// Ensure JWT secret exists for test JWT signing
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";

// Provide a minimal global fetch mock for tests. Individual tests can override it.
if (typeof globalThis.fetch === "undefined") {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	globalThis.fetch = jest.fn(async () => ({
		ok: true,
		status: 200,
		json: async () => ({}),
		text: async () => "",
	}));
}
