import { DEFAULT_WALLET_LIMIT, MAX_FINGERPRINT_BASE64_LENGTH } from "./constants";

export function getBiometricConfigPreview() {
  return {
    host: process.env.SC_BIOMETRICS_API_HOST || "172.16.1.146",
    port: Number(process.env.SC_BIOMETRICS_API_PORT || "8100"),
    referenceLimit: MAX_FINGERPRINT_BASE64_LENGTH,
    user: process.env.SC_BIOMETRICS_API_USER || "admin",
    walletObservedLimit: DEFAULT_WALLET_LIMIT,
  };
}
