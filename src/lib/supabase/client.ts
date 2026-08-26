import { createClient } from '@supabase/supabase-js';

let rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
rawUrl = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

const supabaseUrl = rawUrl;
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * `ref` do projeto Supabase em uso (o subdomínio de `<ref>.supabase.co`).
 *
 * Existe porque há DOIS projetos com o mesmo schema e dados diferentes, e as
 * variáveis são NEXT_PUBLIC_* — ou seja, ficam gravadas no build. Um deploy
 * feito com as variáveis antigas continua falando com o banco antigo por mais
 * que o `.env.local` da máquina esteja certo, e o sintoma é uma migration
 * "sumida". Toda mensagem de erro sobre estrutura ausente precisa dizer em
 * QUAL banco ela falta, senão o diagnóstico é ambíguo.
 */
export const supabaseProjectRef = supabaseUrl
  ? (supabaseUrl.replace(/^https?:\/\//i, '').split('.')[0] || supabaseUrl)
  : '(nenhum)';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
