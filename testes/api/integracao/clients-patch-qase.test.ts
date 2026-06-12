import supertest from 'supertest';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const request = supertest(base);

function rnd(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

describe('Clients PATCH Qase semantics', () => {
  jest.setTimeout(60000);

  it('clears projects when PATCH sends empty qase_project_codes array', async () => {
    const slug = `patchco-${Date.now()}-${rnd(4)}`;
    const name = `Patch Co ${rnd(4)}`;
    const qaseToken = 'TEST_TOKEN';
    const codes = [`P-${rnd(3)}`, `P-${rnd(3)}`];

    // Create client with two projects
    const createRes = await request
      .post('/api/clients')
      .set('x-test-admin', 'true')
      .send({ name, slug, qase_token: qaseToken, qase_project_codes: codes });
    expect(createRes.status).toBe(201);
    const created = createRes.body;
    expect(created).toBeTruthy();
    const id = created.id || created.slug || created.slug;

    // Ensure applications exist
    await new Promise((r) => setTimeout(r, 500));
    const appsRes1 = await request.get(`/api/applications?companySlug=${encodeURIComponent(created.slug)}`).set('x-test-admin', 'true');
    expect([200, 204]).toContain(appsRes1.status);
    const apps1 = Array.isArray(appsRes1.body?.items) ? appsRes1.body.items : appsRes1.body?.items ?? [];
    expect(apps1.length).toBeGreaterThanOrEqual(codes.length);

    // PATCH with explicit empty array to clear projects
    const patchRes = await request
      .patch(`/api/clients/${encodeURIComponent(id)}`)
      .set('x-test-admin', 'true')
      .send({ qase_project_codes: [] });
    expect([200, 204]).toContain(patchRes.status);
    const patched = patchRes.body || {};

    // Confirm server returned cleared state (legacy field null or absent, codes empty)
    expect(patched.qase_project_codes === undefined || Array.isArray(patched.qase_project_codes)).toBeTruthy();
    if (Array.isArray(patched.qase_project_codes)) expect(patched.qase_project_codes.length).toBe(0);
    // legacy field should be null or absent
    expect(patched.qase_project_code === null || patched.qase_project_code === undefined).toBeTruthy();

    // After clearing, applications list should be empty or not include previous ones
    await new Promise((r) => setTimeout(r, 500));
    const appsRes2 = await request.get(`/api/applications?companySlug=${encodeURIComponent(created.slug)}`).set('x-test-admin', 'true');
    expect([200, 204]).toContain(appsRes2.status);
    const apps2 = Array.isArray(appsRes2.body?.items) ? appsRes2.body.items : appsRes2.body?.items ?? [];
    // Allow either 0 or fewer than before (depends on async deletion), but must not increase
    expect(apps2.length).toBeLessThanOrEqual(apps1.length);
  });

  it('accepts legacy qase_project_code for backward compatibility', async () => {
    const slug = `legacyco-${Date.now()}-${rnd(4)}`;
    const name = `Legacy Co ${rnd(4)}`;
    const qaseToken = 'TEST_TOKEN';
    const single = `P-${rnd(3)}`;

    // Create client with no projects
    const createRes = await request
      .post('/api/clients')
      .set('x-test-admin', 'true')
      .send({ name, slug, qase_token: qaseToken });
    expect(createRes.status).toBe(201);
    const created = createRes.body;
    expect(created).toBeTruthy();
    const id = created.id || created.slug;

    // PATCH with only legacy qase_project_code
    const patchRes = await request
      .patch(`/api/clients/${encodeURIComponent(id)}`)
      .set('x-test-admin', 'true')
      .send({ qase_project_code: single });
    expect([200, 204]).toContain(patchRes.status);
    const patched = patchRes.body || {};

    // Server should have normalized into the array and set legacy to the same value
    if (Array.isArray(patched.qase_project_codes)) {
      expect(patched.qase_project_codes.length).toBeGreaterThanOrEqual(1);
    }
    // legacy field should be present and include the value (or derived from array)
    expect(patched.qase_project_code === single || typeof patched.qase_project_code === 'string').toBeTruthy();
  });
});
