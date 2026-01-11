export function cookies() {
  return {
    get: (_name: string) => undefined,
    // minimal API for next/headers cookies store
    keys: () => [],
  };
}

export default { cookies };
