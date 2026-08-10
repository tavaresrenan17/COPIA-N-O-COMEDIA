-- ⚠ ARQUIVO HISTÓRICO — NÃO EXECUTE.
-- Consolidado em ../schema_completo.sql (banco novo) e em 08_correcoes_consistencia.sql (banco existente).
-- Faltam aqui as colunas nivel_sugestao, motivo_sugestao e regra_aplicada_id de extrato_lancamento.
-- =============================================================================
-- ERP "MELHOR GESTÃO" — MIGRATION 07: CONCILIAÇÃO BANCÁRIA (ETAPA 9 COMPLETA)
-- =============================================================================

-- 1. TABELA DE REGISTRO DAS IMPORTAÇÕES DE EXTRATO (OFX / CSV)
CREATE TABLE IF NOT EXISTS public.extrato_importacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_bancaria_id UUID NOT NULL REFERENCES public.conta_bancaria(id) ON DELETE CASCADE,
    arquivo_nome TEXT,
    formato TEXT NOT NULL CHECK (formato IN ('ofx', 'csv')),
    data_inicio DATE,
    data_fim DATE,
    saldo_inicial_arquivo NUMERIC(15,2),
    saldo_final_arquivo NUMERIC(15,2),
    qtd_lancamentos INT DEFAULT 0,
    qtd_conciliados INT DEFAULT 0,
    importado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    importado_por TEXT,
    status TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('processando', 'concluida', 'erro')),
    erro_detalhe TEXT
);

-- 2. TABELA DE LANÇAMENTOS DO EXTRATO BANCÁRIO (FITID ÚNICO)
CREATE TABLE IF NOT EXISTS public.extrato_lancamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    importacao_id UUID REFERENCES public.extrato_importacao(id) ON DELETE SET NULL,
    conta_bancaria_id UUID NOT NULL REFERENCES public.conta_bancaria(id) ON DELETE CASCADE,
    fitid TEXT NOT NULL, -- Identificador Único do OFX
    data_lancamento DATE NOT NULL,
    valor NUMERIC(15,2) NOT NULL, -- Positivo = Entrada/Crédito, Negativo = Saída/Débito
    descricao TEXT,
    documento TEXT,
    tipo_ofx TEXT,
    status TEXT NOT NULL DEFAULT 'nao_conciliado' CHECK (status IN ('nao_conciliado', 'conciliado', 'ignorado', 'divergente')),
    movimento_id UUID REFERENCES public.movimento(id) ON DELETE SET NULL,
    confianca_sugestao INT DEFAULT 0, -- 0 a 100 do motor de casamento
    conciliado_em TIMESTAMPTZ,
    conciliado_por TEXT,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- REGRA DE OURO: ANTI-DUPLICIDADE POR FITID
    CONSTRAINT uq_extrato_fitid UNIQUE (conta_bancaria_id, fitid)
);

-- 3. TABELA DE REGRAS DE AUTOMAÇÃO DE CONCILIAÇÃO POR DESCRIÇÃO
CREATE TABLE IF NOT EXISTS public.conciliacao_regra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_bancaria_id UUID REFERENCES public.conta_bancaria(id) ON DELETE CASCADE,
    padrao_descricao TEXT NOT NULL, -- Trecho a procurar na descrição do extrato
    pessoa_id UUID REFERENCES public.pessoa(id) ON DELETE SET NULL,
    plano_conta_id UUID REFERENCES public.plano_conta(id) ON DELETE SET NULL,
    centro_custo_id UUID REFERENCES public.centro_custo(id) ON DELETE SET NULL,
    acao TEXT NOT NULL DEFAULT 'sugerir_lancamento' CHECK (acao IN ('sugerir_lancamento', 'ignorar')),
    vezes_aplicada INT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ALTERAÇÃO NA TABELA EXISTENTE DE MOVIMENTO
ALTER TABLE public.movimento 
ALTER COLUMN parcela_id DROP NOT NULL;

ALTER TABLE public.movimento
ADD COLUMN IF NOT EXISTS plano_conta_id UUID REFERENCES public.plano_conta(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES public.centro_custo(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tipo_movimento TEXT NOT NULL DEFAULT 'baixa_titulo' CHECK (tipo_movimento IN ('baixa_titulo', 'avulso', 'transferencia')),
ADD COLUMN IF NOT EXISTS conciliado BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS extrato_lancamento_id UUID REFERENCES public.extrato_lancamento(id) ON DELETE SET NULL;

-- 5. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_extrato_fitid ON public.extrato_lancamento(fitid);
CREATE INDEX IF NOT EXISTS idx_extrato_status ON public.extrato_lancamento(conta_bancaria_id, status);
CREATE INDEX IF NOT EXISTS idx_movimento_conciliado ON public.movimento(conta_bancaria_id, conciliado);
