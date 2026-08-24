-- =============================================================================
-- ERP "MELHOR GESTÃO" — MIGRATION 09: OBRA, UNIDADE CONSTRUTIVA E ITEM DE ORÇAMENTO
-- =============================================================================
-- Suporta a reformulação da aba APROPRIAÇÃO do cadastro de títulos, que classifica
-- por (Obra → Unidade Construtiva → Item de Orçamento).
--
-- O script é 100% SEGURO e IDEMPOTENTE:
-- Cria tabelas/colunas se não existirem e pode ser executado várias vezes sem erro.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. GARANTIR ESTRUTURAS DE GRUPO E LINHA DE GESTÃO (SE NÃO EXISTIREM)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grupo_gestao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.linha_gestao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_gestao_id UUID NOT NULL REFERENCES public.grupo_gestao(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  centro_custo_id UUID REFERENCES public.centro_custo(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_linha_gestao_grupo_codigo UNIQUE (grupo_gestao_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_linha_gestao_grupo ON public.linha_gestao(grupo_gestao_id);

-- -----------------------------------------------------------------------------
-- 1. LINHA DE GESTÃO — OBRA VINCULADA
-- -----------------------------------------------------------------------------
ALTER TABLE public.linha_gestao
  ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES public.centro_custo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_linha_gestao_centro_custo ON public.linha_gestao(centro_custo_id);

-- -----------------------------------------------------------------------------
-- 2. ITEM DE ORÇAMENTO — CÓDIGO
-- -----------------------------------------------------------------------------
ALTER TABLE public.orcamento_item
  ADD COLUMN IF NOT EXISTS codigo TEXT;

CREATE INDEX IF NOT EXISTS idx_orcamento_item_centro_custo ON public.orcamento_item(centro_custo_id);

-- -----------------------------------------------------------------------------
-- 3. TITULO_RATEIO — ITEM DE ORÇAMENTO APROPRIADO
-- -----------------------------------------------------------------------------
ALTER TABLE public.titulo_rateio
  ADD COLUMN IF NOT EXISTS orcamento_item_id UUID REFERENCES public.orcamento_item(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_titulo_rateio_orcamento_item ON public.titulo_rateio(orcamento_item_id);

-- -----------------------------------------------------------------------------
-- 4. UNIQUE DO RATEIO — PERMITE MÚLTIPLOS ITENS NA MESMA UNIDADE CONSTRUTIVA
-- -----------------------------------------------------------------------------
ALTER TABLE public.titulo_rateio DROP CONSTRAINT IF EXISTS uq_parcela_centro_custo;

CREATE UNIQUE INDEX IF NOT EXISTS uq_parcela_centro_custo_item
  ON public.titulo_rateio (
    parcela_id,
    centro_custo_id,
    COALESCE(orcamento_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

COMMIT;
