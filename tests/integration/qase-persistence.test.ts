import supertest from 'supertest';

// Integration test: verify that saving a company's Qase token + project codes
// results in Applications being created by the backend (syncCompanyApplications).

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const request = supertest(base);

function rnd(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

describe('Qase persistence integration', () => {
  jest.setTimeout(60000);

  it('creates applications when client is created with qase project codes', async () => {
    const slug = `testco-${Date.now()}-${rnd(4)}`;
    const name = `Test Co ${rnd(4)}`;
    const qaseToken = 'TEST_TOKEN';
    const codes = [`P-${rnd(3)}`, `P-${rnd(3)}`];

    // Create client (as test admin)
    const createRes = await request
      .post('/api/clients')
      .set('x-test-admin', 'true')
      .send({ name, slug, qase_token: qaseToken, qase_project_codes: codes });

    expect(createRes.status).toBe(201);
    const created = createRes.body;
    console.log('DEBUG: createRes.status=', createRes.status);
    console.log('DEBUG: createRes.body=', JSON.stringify(created));
    // debug logs removed
    expect(created).toBeTruthy();
    expect(created.slug).toBeDefined();

    // Give backend a brief moment to sync applications (if async)
    await new Promise((r) => setTimeout(r, 500));

    // Fetch applications for this company
    const appsRes = await request.get(`/api/applications?companySlug=${encodeURIComponent(created.slug)}`).set('x-test-admin', 'true');
    console.log('DEBUG: appsRes.status=', appsRes.status);
    console.log('DEBUG: appsRes.body=', JSON.stringify(appsRes.body));
    expect([200, 204]).toContain(appsRes.status);
    const appsJson = appsRes.body;
    const items = Array.isArray(appsJson?.items) ? appsJson.items : appsJson?.items ?? [];

    // We expect at least as many applications as codes provided
    expect(items.length).toBeGreaterThanOrEqual(codes.length);
  });
});
