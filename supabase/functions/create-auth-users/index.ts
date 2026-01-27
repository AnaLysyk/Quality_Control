// Edge Function to create Auth users and insert profiles/company_users
// Using Deno built-in serve
Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const body = await req.json();
    const { users, company_id } = body; // users: [{email,password,full_name,role,company_role}]
    if (!users || !Array.isArray(users)) return new Response('Invalid payload', { status: 400 });
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) return new Response('Missing env vars', { status: 500 });
    const created = [];
    for (const u of users) {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`
        },
        body: JSON.stringify({ email: u.email, password: u.password, email_confirm: true })
      });
      if (!resp.ok) {
        const text = await resp.text();
        return new Response(`Failed to create user: ${text}`, { status: 500 });
      }
      const data = await resp.json();
      const auth_user_id = data.id;
      // Insert profile
      const profileResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ id: auth_user_id, full_name: u.full_name || null, role: u.role || null, created_at: new Date().toISOString() })
      });
      if (!profileResp.ok) {
        const text = await profileResp.text();
        return new Response(`Failed to insert profile: ${text}`, { status: 500 });
      }
      const profileData = await profileResp.json();
      // Insert company_user
      const companyUserResp = await fetch(`${SUPABASE_URL}/rest/v1/company_users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ user_id: auth_user_id, company_id, role: u.company_role || 'USER', created_at: new Date().toISOString() })
      });
      if (!companyUserResp.ok) {
        const text = await companyUserResp.text();
        return new Response(`Failed to insert company_user: ${text}`, { status: 500 });
      }
      const companyUserData = await companyUserResp.json();
      created.push({ auth_user_id, profile: profileData[0], company_user: companyUserData[0] });
    }
    return new Response(JSON.stringify({ created }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});
