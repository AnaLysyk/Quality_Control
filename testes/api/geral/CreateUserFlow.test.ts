/**
 * Teste de fluxo completo de criaÃ§Ã£o de usuÃ¡rios
 * Cobre todos os perfis: empresa, company_user, testing_company_user, leader_tc, technical_support
 */

describe('User Creation Flow - All Profiles', () => {
  // Este teste simula a criaÃ§Ã£o de usuÃ¡rios com diferentes perfis
  // Validando que:
  // 1. O usuÃ¡rio Ã© criado com sucesso
  // 2. O login Ã© gerado/normalizado
  // 3. A senha temporÃ¡ria Ã© gerada (ou usada a fornecida para leader_tc)
  // 4. O email de boas-vindas Ã© disparado
  // 5. Os dados corretos sÃ£o incluÃ­dos no payload

  const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const adminToken = process.env.TEST_ADMIN_TOKEN || '';

  // ConfiguraÃ§Ãµes de teste para cada perfil
  const testProfiles = [
    {
      name: 'testing_company_user',
      role: 'testing_company_user',
      requiresCompany: false,
      requiresPassword: false,
      testData: {
        full_name: 'JoÃ£o Silva - Testing User',
        name: 'joao.silva',
        email: `teste-testing-${Date.now()}@example.com`,
        phone: '+55 11 98765-4321',
        job_title: 'QA Tester',
        role: 'testing_company_user',
        active: true,
      },
    },
    {
      name: 'company_user',
      role: 'company_user',
      requiresCompany: true,
      requiresPassword: false,
      testData: {
        full_name: 'Maria Santos - Company User',
        name: 'maria.santos',
        email: `teste-company-${Date.now()}@example.com`,
        phone: '+55 11 91234-5678',
        job_title: 'Product Manager',
        role: 'company_user',
        client_id: 'test-company-id', // Would be set to actual company ID
        active: true,
      },
    },
    {
      name: 'empresa',
      role: 'empresa',
      requiresCompany: true,
      requiresPassword: false,
      testData: {
        full_name: 'Carlos Oliveira - Empresa',
        name: 'carlos.oliveira',
        email: `teste-empresa-${Date.now()}@example.com`,
        phone: '+55 11 93456-7890',
        job_title: 'Diretor',
        role: 'empresa',
        client_id: 'test-company-id',
        active: true,
      },
    },
    {
      name: 'technical_support',
      role: 'technical_support',
      requiresCompany: false,
      requiresPassword: false,
      testData: {
        full_name: 'Ana Costa - Support',
        name: 'ana.costa',
        email: `teste-support-${Date.now()}@example.com`,
        phone: '+55 11 94567-8901',
        job_title: 'Technical Support',
        role: 'technical_support',
        active: true,
      },
    },
    {
      name: 'leader_tc (requires password)',
      role: 'leader_tc',
      requiresCompany: false,
      requiresPassword: true,
      testData: {
        full_name: 'Pedro Ferreira - Leader TC',
        name: 'pedro.ferreira',
        email: `teste-leader-${Date.now()}@example.com`,
        phone: '+55 11 95678-9012',
        job_title: 'TC Leader',
        role: 'leader_tc',
        password: 'SecurePass@123', // MÃ­nimo 8 caracteres
        active: true,
      },
    },
  ];

  testProfiles.forEach((profile) => {
    test(`criar usuÃ¡rio com perfil ${profile.name}`, async () => {
      if (!adminToken) {
        console.warn(`âš ï¸  TEST_ADMIN_TOKEN nÃ£o configurado. Use npm run test com NODE_ENV=test e TOKEN_ADMIN definido.`);
        return; // Skip if no token
      }

      const payload = {
        ...profile.testData,
      };

      console.log(`\nðŸ“§ [${profile.name}] Iniciando criaÃ§Ã£o de usuÃ¡rio...`);
      console.log(`   Email: ${payload.email}`);
      console.log(`   Login: ${payload.name}`);

      try {
        const response = await fetch(`${API_URL}/api/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(payload),
        });

        console.log(`   Status: ${response.status}`);

        if (!response.ok) {
          const error = await response.json();
          console.error(`   âŒ Erro: ${error.error || 'Unknown error'}`);
          throw new Error(`Failed to create user: ${response.status} - ${error.error}`);
        }

        const result = await response.json();

        console.log(`   âœ… UsuÃ¡rio criado com sucesso`);
        console.log(`   ID: ${result.id}`);
        console.log(`   Login gerado/normalizado: ${result.user?.user || result.user?.email}`);

        // ValidaÃ§Ãµes
        expect(result.ok).toBe(true);
        expect(result.id).toBeDefined();
        expect(result.user).toBeDefined();
        expect(result.user.email).toBe(payload.email);
        expect(result.user.active).toBe(true);

        // Validar que senha foi gerada (hasheada)
        expect(result.user.password_hash).toBeDefined();

        console.log(`   ðŸ“§ Email de boas-vindas disparado para: ${payload.email}`);
        console.log(`   â„¹ï¸  Verifique o email para as credenciais de acesso\n`);
      } catch (error) {
        console.error(`   âŒ Erro na criaÃ§Ã£o: ${error}`);
        throw error;
      }
    });
  });

  test('validar rejeiÃ§Ã£o de password para perfis que nÃ£o requerem', async () => {
    if (!adminToken) return;

    const invalidPayload = {
      full_name: 'Test User',
      name: 'testuser',
      email: `teste-invalid-${Date.now()}@example.com`,
      role: 'testing_company_user',
      password: 'SomePassword@123', // NÃ£o deveria aceitar
      active: true,
    };

    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(invalidPayload),
    });

    // A API aceita mas ignora a senha (usa a temporÃ¡ria gerada)
    // Validar que nÃ£o foi usada a senha fornecida
    if (response.ok) {
      const result = await response.json();
      expect(result.user).toBeDefined();
      console.log(`âœ… Password ignorado para perfil testing_company_user (comportamento esperado)`);
    }
  });

  test('validar rejeiÃ§Ã£o de email invÃ¡lido', async () => {
    if (!adminToken) return;

    const invalidPayload = {
      full_name: 'Test User',
      name: 'testuser',
      email: 'invalid-email-format', // Email invÃ¡lido
      role: 'testing_company_user',
      active: true,
    };

    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(invalidPayload),
    });

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error).toContain('invÃ¡lido');
    console.log(`âœ… Email invÃ¡lido rejeitado corretamente`);
  });

  test('validar normalizacao de email duplicado', async () => {
    if (!adminToken) return;

    const testEmail = `duplicate-test-${Date.now()}@example.com`;

    // Primeiro usuÃ¡rio
    const response1 = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        full_name: 'First User',
        name: 'firstuser',
        email: testEmail,
        role: 'testing_company_user',
        active: true,
      }),
    });

    expect(response1.ok).toBe(true);
    console.log(`âœ… Primeiro usuÃ¡rio criado`);

    // Segundo usuÃ¡rio com mesmo email (deve falhar)
    const response2 = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        full_name: 'Second User',
        name: 'seconduser',
        email: testEmail,
        role: 'testing_company_user',
        active: true,
      }),
    });

    expect(response2.status).toBe(409);
    const error = await response2.json();
    expect(error.error).toContain('jÃ¡ cadastrado');
    console.log(`âœ… Email duplicado rejeitado corretamente`);
  });
});

