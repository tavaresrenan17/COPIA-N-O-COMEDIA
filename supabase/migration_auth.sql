-- ⚠ ARQUIVO HISTÓRICO — NÃO EXECUTE.
-- Consolidado na seção 14 de ../schema_completo.sql e na seção 13 de migrations/08_correcoes_consistencia.sql.
-- Faltam aqui: auth_user_id, status_confirmacao e token_confirmacao.
-- ==============================================================================
-- ERP "MELHOR GESTÃO" — MIGRAÇÃO SUPABASE AUTENTICAÇÃO E PERMISSÕES (PASSO 5)
-- ==============================================================================
-- Regra Corporativa: Domínio exclusivo @deltaplanobras.com.br
-- ==============================================================================

-- 1. TABELA DE PERFIS DE USUÁRIO (Estende auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.usuario_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL DEFAULT 'Colaborador',
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('administrador', 'gerente', 'operador', 'leitor')),
  is_acesso_geral BOOLEAN DEFAULT false NOT NULL,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_usuario_email_dominio CHECK (email LIKE '%@deltaplanobras.com.br')
);

CREATE INDEX IF NOT EXISTS idx_usuario_perfil_email ON public.usuario_perfil(email);

-- 2. TABELA DE PERMISSÕES POR DEPARTAMENTO
CREATE TABLE IF NOT EXISTS public.usuario_departamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuario_perfil(id) ON DELETE CASCADE,
  departamento_id TEXT NOT NULL CHECK (departamento_id IN ('financeiro', 'comercial', 'rh', 'fiscal', 'juridico')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(usuario_id, departamento_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_dept_user ON public.usuario_departamento(usuario_id);

-- 3. SEED DO USUÁRIO INICIAL PRINCIPAL (RENAN ADMINISTRATIVO)
INSERT INTO public.usuario_perfil (id, email, nome, cargo, role, is_acesso_geral, ativo)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'renan.administrativo@deltaplanobras.com.br',
  'Renan (Administrativo)',
  'Administrador Geral',
  'administrador',
  true,
  true
)
ON CONFLICT (email) DO UPDATE SET
  nome = EXCLUDED.nome,
  role = EXCLUDED.role,
  is_acesso_geral = true;
