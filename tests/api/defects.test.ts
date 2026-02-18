import request from 'supertest';
import { describe, it, expect } from '@jest/globals';

const baseUrl = 'http://localhost:3000';

describe('API /api/companies/[companyId]/defects', () => {
  const companyId = 'test-company';
  it('deve criar e listar defeitos', async () => {
    jest.setTimeout(20000);
    const resCreate = await request(baseUrl)
      .post(`/api/companies/${companyId}/defects`)
      .send({ title: 'Defeito Teste', projectId: 'proj-1', createdBy: 'user-1' });
    if (resCreate.status !== 201) {
      console.error('Erro ao criar defeito:', resCreate.status, resCreate.body);
    }
    expect(resCreate.status).toBe(201);
    expect(resCreate.body.title).toBe('Defeito Teste');

    const resList = await request(baseUrl).get(`/api/companies/${companyId}/defects`);
    expect(resList.status).toBe(200);
    expect(Array.isArray(resList.body)).toBe(true);
  });
});
