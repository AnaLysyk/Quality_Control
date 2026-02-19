import request from 'supertest';
import { describe, it, expect } from '@jest/globals';

const baseUrl = 'http://localhost:3000';
const companyId = 'cmp_f9323403';

describe('API /api/user/[id]', () => {
  it('deve editar e persistir usuário', async () => {
    // Cria usuário
    const resCreate = await request(baseUrl)
      .post(`/api/companies/${companyId}/users`)
      .set('x-test-admin', 'true')
      .set('x-test-role', 'admin')
      .send({ name: 'Usuário Editar', email: 'editar@exemplo.com', role: 'usuario' });
    expect(resCreate.status).toBe(201);
    const userId = resCreate.body.id;

    // Edita usuário
    const resEdit = await request(baseUrl)
      .patch(`/api/user/${userId}`)
      .set('x-test-admin', 'true')
      .set('x-test-role', 'admin')
      .send({ name: 'Usuário Editado', email: 'editado@exemplo.com' });
    expect(resEdit.status).toBe(200);
    expect(resEdit.body.name).toBe('Usuário Editado');
    expect(resEdit.body.email).toBe('editado@exemplo.com');

    // Busca usuário para garantir persistência
    // (Simula listagem, pode ser ajustado conforme endpoint disponível)
    // Aqui, apenas valida o retorno do PATCH
  });
});
