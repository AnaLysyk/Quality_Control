import request from 'supertest';
import { describe, it, expect } from '@jest/globals';

const baseUrl = 'http://localhost:3000';

describe('API /api/companies', () => {
  it('deve criar e listar empresas', async () => {
    const resCreate = await request(baseUrl)
      .post('/api/companies')
      .send({ name: 'Empresa Teste', slug: 'empresa-teste' });
    expect(resCreate.status).toBe(201);
    expect(resCreate.body.name).toBe('Empresa Teste');

    const resList = await request(baseUrl).get('/api/companies');
    expect(resList.status).toBe(200);
    expect(Array.isArray(resList.body)).toBe(true);
  });
});
