import request from 'supertest';
import { describe, it, expect } from '@jest/globals';

const baseUrl = 'http://localhost:3000';

describe('Projects API - Metrics Aggregation', () => {
  it('should return projects with aggregated metrics', async () => {
    // Ajuste o companyId conforme necessário para o ambiente de teste
    const companyId = 'test-company';
    const res = await request(baseUrl)
      .get(`/api/companies/${companyId}/projects`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const project of res.body) {
      expect(project).toHaveProperty('metrics');
      expect(project.metrics).toHaveProperty('totalRuns');
      expect(project.metrics).toHaveProperty('totalPassed');
      expect(project.metrics).toHaveProperty('totalFailed');
      expect(project.metrics).toHaveProperty('totalCases');
      expect(project.metrics).toHaveProperty('passRate');
    }
  });
});
