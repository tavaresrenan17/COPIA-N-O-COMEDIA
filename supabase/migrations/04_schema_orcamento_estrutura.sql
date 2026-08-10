-- ⚠ ARQUIVO HISTÓRICO — NÃO EXECUTE.
-- Consolidado em ../schema_completo.sql (banco novo) e em 08_correcoes_consistencia.sql (banco existente).
-- Os CREATE POLICY daqui não têm DROP antes: reexecutar quebra com "policy already exists".
-- ============================================================================
-- ERP MELHOR GESTÃO - MIGRATION 04: CADASTRO E ESTRUTURA DO ORÇAMENTO (ETAPA 6)
-- ============================================================================

-- 1. TABELA PRINCIPAL: ORÇAMENTO
CREATE TABLE IF NOT EXISTS public.orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id UUID NOT NULL REFERENCES public.centro_custo(id),
  nome TEXT NOT NULL,
  versao INT NOT NULL DEFAULT 1,
  orcamento_base_id UUID REFERENCES public.orcamento(id),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('rascunho', 'aprovado', 'revisado', 'encerrado')) DEFAULT 'rascunho',
  valor_total NUMERIC(15,2) DEFAULT 0.00,
  aprovado_em TIMESTAMPTZ,
  aprovado_por TEXT,
  motivo_revisao TEXT,
  observacao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_centro_custo_versao UNIQUE (centro_custo_id, versao)
);

-- Index para busca rápida por centro de custo e status
CREATE INDEX IF NOT EXISTS idx_orcamento_cc_status ON public.orcamento(centro_custo_id, status);

-- 2. TABELA ITENS DO ORÇAMENTO (NÍVEL 2 DO PLANO DE CONTAS)
CREATE TABLE IF NOT EXISTS public.orcamento_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamento(id) ON DELETE CASCADE,
  plano_conta_id UUID NOT NULL REFERENCES public.plano_conta(id),
  centro_custo_id UUID REFERENCES public.centro_custo(id),
  descricao TEXT,
  quantidade NUMERIC(15,4),
  unidade TEXT,
  valor_unitario NUMERIC(15,4),
  valor_total NUMERIC(15,2) NOT NULL CHECK (valor_total >= 0),
  ordem INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para listagem de itens do orçamento
CREATE INDEX IF NOT EXISTS idx_orcamento_item_orcamento_id ON public.orcamento_item(orcamento_id);

-- 3. TABELA DISTRIBUIÇÃO PERIÓDICA DO ITEM (MÊS A MÊS)
CREATE TABLE IF NOT EXISTS public.orcamento_item_periodo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_item_id UUID NOT NULL REFERENCES public.orcamento_item(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL, -- sempre o dia 1 do mês (ex: 2026-01-01)
  valor NUMERIC(15,2) NOT NULL CHECK (valor >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_item_mes_referencia UNIQUE (orcamento_item_id, mes_referencia)
);

-- Index para consolidação periódica
CREATE INDEX IF NOT EXISTS idx_orcamento_item_periodo_item ON public.orcamento_item_periodo(orcamento_item_id);

-- RLS POLICIES (Desabilitado RLS em modo de desenvolvimento ou liberado para serviço)
ALTER TABLE public.orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_item_periodo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo em orcamento para autenticados" ON public.orcamento FOR ALL USING (true);
CREATE POLICY "Permitir tudo em orcamento_item para autenticados" ON public.orcamento_item FOR ALL USING (true);
CREATE POLICY "Permitir tudo em orcamento_item_periodo para autenticados" ON public.orcamento_item_periodo FOR ALL USING (true);
