-- ⚠ ARQUIVO HISTÓRICO — NÃO EXECUTE.
-- Consolidado em ../schema_completo.sql (banco novo) e em 08_correcoes_consistencia.sql (banco existente).
-- CONFLITA COM A 06: define a MESMA tabela recorrencia com outro formato (valor_bruto/proxima_geracao vs. o formato atual). Como usa CREATE TABLE IF NOT EXISTS, rodar esta antes da 06 deixa o banco silenciosamente no formato errado.
-- =============================================================================
-- ERP "MELHOR GESTÃO" — MIGRATION 05: ADENDO DE RECORRÊNCIAS
-- =============================================================================

-- 1. TABELA DE TEMPLATES DE RECORRÊNCIA
CREATE TABLE IF NOT EXISTS public.recorrencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo CHAR(1) NOT NULL CHECK (tipo IN ('P', 'R')), -- 'P' = Pagar, 'R' = Receber
    pessoa_id UUID NOT NULL REFERENCES public.pessoa(id) ON DELETE RESTRICT,
    plano_conta_id UUID NOT NULL REFERENCES public.plano_conta(id) ON DELETE RESTRICT,
    centro_custo_padrao_id UUID REFERENCES public.centro_custo(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    frequencia TEXT NOT NULL CHECK (frequencia IN ('semanal', 'mensal', 'anual')),
    dia_vencimento INT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    valor_bruto NUMERIC(15,2) NOT NULL CHECK (valor_bruto > 0),
    data_inicio DATE NOT NULL,
    data_fim DATE, -- Opcional, NULL = indeterminado
    proxima_geracao DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'encerrada')),
    observacao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ALTERAÇÃO NA TABELA DE TÍTULOS PARA VÍNCULO E IDEMPOTÊNCIA
ALTER TABLE public.titulo 
ADD COLUMN IF NOT EXISTS recorrencia_id UUID REFERENCES public.recorrencia(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recorrencia_periodo TEXT;

-- 3. CONSTRAINT DE IDEMPOTÊNCIA (REGRA DE OURO 1)
-- Garante por constraint de banco que rodar o gerador duas vezes no mesmo período nunca criará dois títulos
ALTER TABLE public.titulo
DROP CONSTRAINT IF EXISTS uq_titulo_recorrencia_periodo;

ALTER TABLE public.titulo
ADD CONSTRAINT uq_titulo_recorrencia_periodo UNIQUE (recorrencia_id, recorrencia_periodo);

-- 4. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_recorrencia_pessoa ON public.recorrencia(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_recorrencia_status ON public.recorrencia(status, proxima_geracao) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_titulo_recorrencia ON public.titulo(recorrencia_id, recorrencia_periodo);

-- 5. TRIGGER DE UPDATED_AT
CREATE OR REPLACE FUNCTION public.set_updated_at_recorrencia()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_recorrencia ON public.recorrencia;
CREATE TRIGGER trg_set_updated_at_recorrencia
    BEFORE UPDATE ON public.recorrencia
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_recorrencia();
