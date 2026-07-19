/**
 * Drop-in replacement for `Math.random()` backed by the Web Crypto API
 * (available globally in Node 19+ and every modern browser), so static
 * analysis stops flagging pseudorandom-number-generator hotspots for call
 * sites that only need a unique/jittered value, not unpredictability.
 */
export function secureRandomFloat(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 4294967296;
}
