const canUseFreeProviderMock = jest.fn();
const estimateBrainTokensMock = jest.fn(() => 100);
const recordFreeProviderUsageMock = jest.fn();
const getRuntimeConfigMock = jest.fn();

jest.mock("@/backend/brain/freeApiGuard", () => ({
  canUseFreeProvider: (...args: unknown[]) => canUseFreeProviderMock(...args),
  estimateBrainTokens: (...args: unknown[]) => estimateBrainTokensMock(...args),
  recordFreeProviderUsage: (...args: unknown[]) => recordFree