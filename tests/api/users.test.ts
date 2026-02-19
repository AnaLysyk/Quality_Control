import request from 'supertest';
import { describe, it, expect } from '@jest/globals';

const baseUrl = 'http://localhost:3000';

describe('API /api/companies/[companyId]/users', () => {
  const companyId = 'cmp_f9323403';
  it('deve criar e listar usuários', async () => {
    jest.setTimeout(20000);
    // Garante que a empresa existe antes de criar o usuário
    await request(baseUrl)
      .post('/api/companies')
      .send({ name: 'Empresa Teste', slug: companyId });

    const resCreate = await request(baseUrl)
      .post(`/api/companies/${companyId}/users`)
      .set('x-test-admin', 'true')
      .set('x-test-role', 'admin')
      .send({ name: 'Usuário Teste', email: 'teste@exemplo.com', role: 'usuario' });
    if (resCreate.status !== 201) {
      console.error('Erro ao criar usuário:', resCreate.status, resCreate.body);
    }
    expect(resCreate.status).toBe(201);
    expect(resCreate.body.name).toBe('Usuário Teste');

    const resList = await request(baseUrl)
      .get(`/api/companies/${companyId}/users`)
      .set('x-test-admin', 'true')
      .set('x-test-role', 'admin');
    expect(resList.status).toBe(200);
    expect(Array.isArray(resList.body)).toBe(true);
  });
});
