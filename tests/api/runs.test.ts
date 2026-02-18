import request from 'supertest';
import { describe, it, expect } from '@jest/globals';

const baseUrl = 'http://localhost:3000';

describe('API /api/companies/[companyId]/runs', () => {
  const companyId = 'test-company';
  it('deve criar e listar runs', async () => {
    jest.setTimeout(20000);
    const resCreate = await request(baseUrl)
      .post(`/api/companies/${companyId}/runs`)
      .send({ name: 'Run Teste', projectId: 'proj-1' });
    if (resCreate.status !== 201) {
      console.error('Erro ao criar run:', resCreate.status, resCreate.body);
    }
    expect(resCreate.status).toBe(201);
    expect(resCreate.body.name).toBe('Run Teste');

    const resList = await request(baseUrl).get(`/api/companies/${companyId}/runs`);
    expect(resList.status).toBe(200);
    expect(Array.isArray(resList.body)).toBe(true);
  });
});
