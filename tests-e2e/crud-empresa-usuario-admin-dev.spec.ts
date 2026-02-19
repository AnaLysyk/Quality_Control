import { test, expect } from '@playwright/test';

// Utilitário para criar e remover entidades via API
// Simula autenticação de admin global via header (role admin)
const ADMIN_HEADER = { 'x-test-admin': 'true', 'x-test-role': 'admin' };
import type { Page, APIResponse } from '@playwright/test';

async function apiRequest(
  page: Page,
  method: string,
  url: string,
  data?: any
): Promise<APIResponse> {
  const headers = { 'Content-Type': 'application/json', 'x-test-admin': 'true', 'x-test-role': 'admin' };
  if (method.toUpperCase() === 'POST') {
    return await page.request.post(url, {
      headers,
      data
    });
  }
  if (method.toUpperCase() === 'DELETE') {
    // DELETE para /api/companies usa query param, demais DELETEs usam body JSON
    if (url === '/api/companies' && data && data.id) {
      return await page.request.fetch(`/api/companies?id=${encodeURIComponent(data.id)}`, {
        method: 'DELETE',
        headers,
      });
    }
    return await page.request.delete(url, {
      headers,
      data
    });
  }
  // Para outros métodos, usa fetch
  const options = {
    method,
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  };
  return await page.request.fetch(url, options);
}

test.describe('Cenários CRUD empresa/usuário/admin/dev', () => {
    test('Criar e excluir empresa (integração Qase)', async ({ page }) => {
      // Cria empresa integrada ao Qase
      const slugQase = 'empresa-qase-' + Date.now() + '-' + Math.floor(Math.random()*10000);
      const createRes = await apiRequest(page, 'POST', '/api/clients', {
        name: 'Empresa Qase',
        company_name: 'Empresa Qase',
        integration_mode: 'qase',
        qase_project_code: 'QASEPROJ', // Substitua por um código válido de projeto Qase
        qase_token: process.env.QASE_TOKEN || 'token-fake', // Use variável de ambiente real no CI
      });
      if (!createRes.ok()) {
        const error = await createRes.json().catch(() => ({}));
        console.error('Erro ao criar empresa (Qase):', error);
      }
      expect(createRes.ok(), 'POST /api/clients (Qase) deve retornar status 2xx').toBeTruthy();
      const company = await createRes.json();
      expect(company).toHaveProperty('id');
      companyId = company.id || company.client?.id;

      // Remove empresa
      const delRes = await apiRequest(page, 'DELETE', `/api/companies`, { id: companyId });
      expect(delRes.ok()).toBeTruthy();
    });
  let companyId: string;
  let userId: string;
  let adminId: string;
  let devId: string;

  test('Criar e excluir empresa', async ({ page }) => {
    // Cria empresa
    const slug = 'empresa-teste-' + Date.now() + '-' + Math.floor(Math.random()*10000);
    const createRes = await apiRequest(page, 'POST', '/api/clients', {
      name: 'Empresa Teste',
      company_name: 'Empresa Teste',
      integration_mode: 'manual'
    });
    if (!createRes.ok()) {
      const error = await createRes.json().catch(() => ({}));
      console.error('Erro ao criar empresa:', error);
    }
    expect(createRes.ok(), 'POST /api/companies deve retornar status 2xx').toBeTruthy();
    const company = await createRes.json();
    expect(company).toHaveProperty('id');
    companyId = company.id || company.client?.id;

    // Remove empresa
    const delRes = await apiRequest(page, 'DELETE', `/api/companies`, { id: companyId });
    expect(delRes.ok()).toBeTruthy();
  });

  test('Criar e excluir usuário', async ({ page }) => {
    // Cria empresa para o usuário
    const slugUser = 'empresa-usuario-' + Date.now() + '-' + Math.floor(Math.random()*10000);
    const createCompany = await apiRequest(page, 'POST', '/api/clients', {
      name: 'Empresa Usuário',
      company_name: 'Empresa Usuário',
      integration_mode: 'manual'
    });
    if (!createCompany.ok()) {
      const error = await createCompany.json().catch(() => ({}));
      console.error('Erro ao criar empresa (usuário):', error);
    }
    expect(createCompany.ok(), 'POST /api/companies deve retornar status 2xx').toBeTruthy();
    const company = await createCompany.json();
    companyId = company.id || company.client?.id;

    // Cria usuário
    const createUser = await apiRequest(page, 'POST', `/api/companies/${companyId}/users`, { name: 'Usuário Teste', email: 'user@teste.com', role: 'usuario' });
    expect(createUser.ok()).toBeTruthy();
    const user = await createUser.json();
    expect(user).toHaveProperty('id');
    userId = user.id;

    // Remove usuário
    const delUser = await apiRequest(page, 'DELETE', `/api/companies/${companyId}/users`, { id: userId });
    expect(delUser.ok()).toBeTruthy();
    // Remove empresa
    await apiRequest(page, 'DELETE', `/api/companies`, { id: companyId });
  });

  test('Criar e excluir admin', async ({ page }) => {
    // Cria empresa para o admin
    const slugAdmin = 'empresa-admin-' + Date.now() + '-' + Math.floor(Math.random()*10000);
    const createCompany = await apiRequest(page, 'POST', '/api/clients', {
      name: 'Empresa Admin',
      company_name: 'Empresa Admin',
      integration_mode: 'manual'
    });
    if (!createCompany.ok()) {
      const error = await createCompany.json().catch(() => ({}));
      console.error('Erro ao criar empresa (admin):', error);
    }
    expect(createCompany.ok(), 'POST /api/companies deve retornar status 2xx').toBeTruthy();
    const company = await createCompany.json();
    companyId = company.id || company.client?.id;

    // Cria admin
    const createAdmin = await apiRequest(page, 'POST', `/api/companies/${companyId}/users`, { name: 'Admin Teste', email: 'admin@teste.com', role: 'admin' });
    expect(createAdmin.ok()).toBeTruthy();
    const admin = await createAdmin.json();
    expect(admin).toHaveProperty('id');
    adminId = admin.id;

    // Remove admin
    const delAdmin = await apiRequest(page, 'DELETE', `/api/companies/${companyId}/users`, { id: adminId });
    expect(delAdmin.ok()).toBeTruthy();
    // Remove empresa
    await apiRequest(page, 'DELETE', `/api/companies`, { id: companyId });
  });

  test('Criar e excluir dev', async ({ page }) => {
    // Cria empresa para o dev
    const slugDev = 'empresa-dev-' + Date.now() + '-' + Math.floor(Math.random()*10000);
    const createCompany = await apiRequest(page, 'POST', '/api/clients', {
      name: 'Empresa Dev',
      company_name: 'Empresa Dev',
      integration_mode: 'manual'
    });
    if (!createCompany.ok()) {
      const error = await createCompany.json().catch(() => ({}));
      console.error('Erro ao criar empresa (dev):', error);
    }
    expect(createCompany.ok(), 'POST /api/companies deve retornar status 2xx').toBeTruthy();
    const company = await createCompany.json();
    companyId = company.id || company.client?.id;

    // Cria dev
    const createDev = await apiRequest(page, 'POST', `/api/companies/${companyId}/users`, { name: 'Dev Teste', email: 'dev@teste.com', role: 'dev' });
    expect(createDev.ok()).toBeTruthy();
    const dev = await createDev.json();
    expect(dev).toHaveProperty('id');
    devId = dev.id;

    // Remove dev
    const delDev = await apiRequest(page, 'DELETE', `/api/companies/${companyId}/users`, { id: devId });
    expect(delDev.ok()).toBeTruthy();
    // Remove empresa
    await apiRequest(page, 'DELETE', `/api/companies`, { id: companyId });
  });
});
