import { createClient } from '@supabase/supabase-js';

// Carrega as variáveis de ambiente do .env.local ou do ambiente Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL e/ou Publishable Key não configurados nas variáveis de ambiente.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
