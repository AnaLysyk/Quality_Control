import request from 'supertest';
import { describe, it, expect } from '@jest/globals';

const baseUrl = 'http://localhost:3000';

describe('API /api/companies/[companyId]/tickets', () => {
  const companyId = 'test-company';
  it('deve criar e listar chamados multiempresa', async () => {
    jest.setTimeout(20000);
    const resCreate = await request(baseUrl)
      .post(`/api/companies/${companyId}/tickets`)
      .send({ titulo: 'Chamado Teste', descricao: 'Descrição', criadoPor: 'user-1' });
    if (resCreate.status !== 201) {
      console.error('Erro ao criar chamado:', resCreate.status, resCreate.body);
    }
    expect(resCreate.status).toBe(201);
    expect(resCreate.body.titulo).toBe('Chamado Teste');

    const resList = await request(baseUrl).get(`/api/companies/${companyId}/tickets`);
    expect(resList.status).toBe(200);
    expect(Array.isArray(resList.body)).toBe(true);
  });
});

describe('API /api/chamados (public)', () => {
  it('deve criar chamado sem autenticação', async () => {
    jest.setTimeout(20000);
    const resCreate = await request(baseUrl)
      .post('/api/chamados')
      .send({ title: 'Chamado Público', description: 'Aberto por qualquer um', type: 'tarefa', priority: 'medium' });
    if (![200, 201].includes(resCreate.status)) {
      console.error('Erro ao criar chamado público:', resCreate.status, resCreate.body);
    }
    expect([200, 201]).toContain(resCreate.status);
    expect(resCreate.body.item?.title || resCreate.body.title).toBe('Chamado Público');
  });

  it('deve listar chamados sem autenticação', async () => {
    const resList = await request(baseUrl).get('/api/chamados?scope=all');
    expect(resList.status).toBe(200);
    expect(Array.isArray(resList.body.items || resList.body)).toBe(true);
  });
});
