// Carrega variáveis do .env apenas em desenvolvimento/local
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch {}
}

const { createClient } = require('@supabase/supabase-js');
const nodefetch = require('node-fetch');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[ERRO] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não definidos. Configure variáveis de ambiente ou .env.');
  process.exit(1);
}
// Admin client (service role)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
type CreatedUser = { id: string; email: string; password: string };
async function createTestUser(email: string, password: string): Promise<CreatedUser> {
  const resp = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (resp.error) throw resp.error;
  if (!resp.data?.user?.id) throw new Error('No user id returned');
  return { id: resp.data.user.id, email, password };
}
async function deleteTestUser(uid: string) {
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) console.warn('Failed to delete user', uid, error.message);
}
async function signIn(email: string, password: string) {
  const { data, error } = await admin.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data?.session?.access_token) throw new Error('No access token returned');
  return data.session.access_token;
}
async function callViewWithToken(token: string) {
  const url = `${SUPABASE_URL}/rest/v1/clients_view?select=*`;
  const headers = {
    Authorization: `Bearer ${token}`,
    apikey: SERVICE_ROLE_KEY || '',
    Prefer: 'return=representation'
  };
  const res = await nodefetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Request failed: ${res.status} ${res.statusText} - ${txt}`);
  }
  const json = await res.json();
  return json;
}
async function main() {
  console.log('[INFO] Criando usuários de teste...');
  const adminEmail = `admin_test_${Date.now()}@example.com`;
  const userEmail = `user_test_${Date.now()}@example.com`;
  const password = 'SupabaseTest123!';
  let adminUser: CreatedUser | null = null;
  let normalUser: CreatedUser | null = null;
  try {
    adminUser = await createTestUser(adminEmail, password);
    normalUser = await createTestUser(userEmail, password);
    console.log('[INFO] Usuários criados:', adminUser.id, normalUser.id);
    try {
      await admin.from('user_profiles').upsert({ auth_user_id: adminUser.id, user_role: 'admin' });
      console.log('[INFO] Upsert em user_profiles para admin (se existir a tabela).');
    } catch (e) {
      console.log('[INFO] Ignorando upsert em user_profiles (tabela pode não existir).');
    }
    console.log('[INFO] Fazendo login dos usuários de teste...');
    const adminToken = await signIn(adminUser.email, password);
    const userToken = await signIn(normalUser.email, password);
    console.log('[INFO] Consultando a view como admin...');
    const adminRows = await callViewWithToken(adminToken);
    console.log(`[INFO] Admin retornou ${Array.isArray(adminRows) ? adminRows.length : 0} linhas.`);
    console.log('[INFO] Consultando a view como usuário comum...');
    const userRows = await callViewWithToken(userToken);
    console.log(`[INFO] Usuário comum retornou ${Array.isArray(userRows) ? userRows.length : 0} linhas.`);
    const pass = (Array.isArray(adminRows) && Array.isArray(userRows) && adminRows.length >= userRows.length);
    console.log('----- RESULTADO FINAL -----');
    console.log(`[RESULT] Linhas admin: ${adminRows.length}`);
    console.log(`[RESULT] Linhas usuário:  ${userRows.length}`);
    if (pass) {
      console.log('[SUCESSO] Admin vê >= linhas que usuário comum. RLS OK.');
    } else {
      console.log('[FALHA] Admin vê menos linhas que usuário comum! (RLS pode estar incorreto)');
    }
    console.log('[AMOSTRA] Admin:', JSON.stringify(adminRows.slice(0, 5), null, 2));
    console.log('[AMOSTRA] Usuário:', JSON.stringify(userRows.slice(0, 5), null, 2));
  } catch (err) {
    let msg = '';
    if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
      msg = (err as any).message;
    } else {
      msg = JSON.stringify(err);
    }
    console.error('[ERRO] Durante o teste:', msg);
    process.exitCode = 1;
  } finally {
    if (adminUser) await deleteTestUser(adminUser.id);
    if (normalUser) await deleteTestUser(normalUser.id);
    console.log('[INFO] Cleanup dos usuários de teste finalizado.');
    process.exit();
  }
}
main().catch((e) => {
  let msg = '';
  if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
    msg = (e as any).message;
  } else {
    msg = JSON.stringify(e);
  }
  console.error('[ERRO NÃO TRATADO]', msg);
  process.exit(1);
});
