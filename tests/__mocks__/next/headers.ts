/* eslint-disable @typescript-eslint/no-unused-vars, import/no-anonymous-default-export */
function cookies() {
  return {
    get: (_name: string) => undefined,
    // minimal API for next/headers cookies store
    keys: () => [],
  };
}

export { cookies };
export default { cookies };
