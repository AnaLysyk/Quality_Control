/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Manual Jest mock for @supabase/supabase-js used across tests.
// Returns the test-provided `supabaseServer` mock when available, otherwise safe stubs.
export function createClient(url: string, key: string, opts?: any) {
  // If tests have mocked '@/lib/supabaseServer', prefer its `supabaseServer` object.
  try {
    // Use require so jest's module system can return the mocked module.
    const mod = require('@/lib/supabaseServer');
    if (mod && mod.supabaseServer) {
      return mod.supabaseServer;
    }
  } catch (_err) {
    // ignore — fallback to safe stub
  }

  // Minimal safe stub to avoid real network calls in tests that don't mock supabaseServer.
  // jest.fn is available in the Jest environment when these mocks are loaded.
  const auth = {
    signInWithPassword: (credentials: any) => Promise.resolve({ data: null, error: null }),
    getUser: (token: any) => Promise.resolve({ data: { user: null }, error: null }),
  };

  const queryChain = () => {
    const chain: any = {
      select: () => chain,
      order: () => chain,
      eq: () => chain,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      insert: () => chain,
      update: () => chain,
      limit: () => chain,
      then: (cb: any) => Promise.resolve(cb({ data: null, error: null })),
    };
    return chain;
  };

  const from = (_table: string) => queryChain();

  return { auth, from };
}
