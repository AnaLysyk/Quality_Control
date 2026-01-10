import { computeRiskFromInputs } from '@/app/testing-metric/types';

describe('computeRiskFromInputs', () => {
  it('returns stable when no issues', () => {
    const res = computeRiskFromInputs({});
    expect(res.category).toBe('stable');
    expect(res.score).toBe(0);
  });

  it('adds gate failed points', () => {
    const res = computeRiskFromInputs({ gateFailed: true });
    expect(res.score).toBeGreaterThanOrEqual(40);
    expect(res.category).not.toBe('stable');
  });

  it('combines factors', () => {
    const res = computeRiskFromInputs({ gateFailed: true, negativeTrendPercent: 10, runsOpenDays: 10, missingData: true, passRateBelowMinimum: true });
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(res.category).toBe('risk');
  });
});
