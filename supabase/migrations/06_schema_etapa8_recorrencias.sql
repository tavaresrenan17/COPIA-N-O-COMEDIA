-- ⚠ ARQUIVO HISTÓRICO — NÃO EXECUTE.
-- Consolidado em ../schema_completo.sql (banco novo) e em 08_correcoes_consistencia.sql (banco existente).
-- Versão canonía das recorrências, porém com as colunas valor/proxima_competencia. No schema atual foram renomeadas para valor_bruto/proxima_competencia para casar com src/data/types.ts.
-- =============================================================================
-- ERP "MELHOR GESTÃO" — MIGRATION 06: ETAPA 8 (RECORRÊNCIAS DE TÍTULOS COMPLETO)
-- =============================================================================

-- 1. TABELA DE FERIADOS (PARA AJUSTE DE DIA ÚTIL)
CREATE TABLE IF NOT EXISTS public.feriado (
    data DATE PRIMARY KEY,
    descricao TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserção inicial de feriados nacionais de 2026
INSERT INTO public.feriado (data, descricao) VALUES
('2026-01-01', 'Confraternização Universal'),
('2026-02-16', 'Carnaval (Segunda)'),
('2026-02-17', 'Carnaval (Terça)'),
('2026-04-03', 'Sexta-feira Santa'),
('2026-04-21', 'Tiradentes'),
('2026-05-01', 'Dia do Trabalho'),
('2026-06-04', 'Corpus Christi'),
('2026-09-07', 'Independência do Brasil'),
('2026-10-12', 'Nossa Senhora Aparecida'),
('2026-11-02', 'Finados'),
('2026-11-15', 'Proclamação da República'),
('2026-12-25', 'Natal')
ON CONFLICT (data) DO NOTHING;

-- 2. TABELA MASTER DE RECORRÊNCIA
CREATE TABLE IF NOT EXISTS public.recorrencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo CHAR(1) NOT NULL CHECK (tipo IN ('P', 'R')),
    pessoa_id UUID NOT NULL REFERENCES public.pessoa(id) ON DELETE RESTRICT,
    plano_conta_id UUID NOT NULL REFERENCES public.plano_conta(id) ON DELETE RESTRICT,
    descricao TEXT NOT NULL,
    valor NUMERIC(15,2) DEFAULT 0,
    tipo_valor TEXT NOT NULL DEFAULT 'fixo' CHECK (tipo_valor IN ('fixo', 'variavel')),
    frequencia TEXT NOT NULL CHECK (frequencia IN ('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
    dia_vencimento INT CHECK (dia_vencimento BETWEEN 1 AND 31),
    dia_semana INT CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Domingo, 1=Segunda, etc.
    ajuste_dia_util TEXT NOT NULL DEFAULT 'nenhum' CHECK (ajuste_dia_util IN ('nenhum', 'antecipa', 'posterga')),
    data_inicio DATE NOT NULL,
    data_fim DATE,
    qtd_ocorrencias INT,
    antecedencia_geracao INT NOT NULL DEFAULT 30,
    gerar_automatico BOOLEAN NOT NULL DEFAULT false,
    indice_reajuste TEXT NOT NULL DEFAULT 'nenhum' CHECK (indice_reajuste IN ('nenhum', 'IGPM', 'IPCA', 'fixo')),
    mes_reajuste INT CHECK (mes_reajuste BETWEEN 1 AND 12),
    percentual_reajuste NUMERIC(7,4) DEFAULT 0,
    ultima_competencia_gerada DATE,
    proxima_competencia DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'encerrada')),
    observacao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA DE RATEIO DA RECORRÊNCIA (SOMA 100%)
CREATE TABLE IF NOT EXISTS public.recorrencia_rateio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recorrencia_id UUID NOT NULL REFERENCES public.recorrencia(id) ON DELETE CASCADE,
    centro_custo_id UUID NOT NULL REFERENCES public.centro_custo(id) ON DELETE RESTRICT,
    percentual NUMERIC(7,4) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABELA DE AUDITORIA E OCORRÊNCIAS (ANTI-DUPLICIDADE E FATOR DE IDEMPOTÊNCIA)
CREATE TABLE IF NOT EXISTS public.recorrencia_ocorrencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recorrencia_id UUID NOT NULL REFERENCES public.recorrencia(id) ON DELETE CASCADE,
    competencia DATE NOT NULL, -- Sempre dia 1º do mês de referência
    titulo_id UUID REFERENCES public.titulo(id) ON DELETE SET NULL,
    valor_gerado NUMERIC(15,2),
    data_vencimento DATE NOT NULL,
    origem TEXT NOT NULL CHECK (origem IN ('automatico', 'manual')),
    status TEXT NOT NULL DEFAULT 'gerado' CHECK (status IN ('gerado', 'pulado', 'cancelado')),
    gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    gerado_por TEXT,
    motivo TEXT,
    CONSTRAINT uq_recorrencia_competencia UNIQUE (recorrencia_id, competencia)
);

-- 5. TABELA DE HISTÓRICO DE REAJUSTES CONTRATUAIS
CREATE TABLE IF NOT EXISTS public.recorrencia_reajuste (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recorrencia_id UUID NOT NULL REFERENCES public.recorrencia(id) ON DELETE CASCADE,
    data_reajuste DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_anterior NUMERIC(15,2) NOT NULL,
    valor_novo NUMERIC(15,2) NOT NULL,
    percentual NUMERIC(7,4) NOT NULL,
    indice TEXT,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. TABELA DE LOG DE EXECUÇÃO DA FILA AUTOMÁTICA
CREATE TABLE IF NOT EXISTS public.recorrencia_log_execucao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_execucao TIMESTAMPTZ NOT NULL DEFAULT now(),
    qtd_geradas INT NOT NULL DEFAULT 0,
    qtd_puladas INT NOT NULL DEFAULT 0,
    erros_json JSONB
);

-- 7. ALTERAÇÃO NA TABELA DE TÍTULOS PARA SUPORTE A VALOR VARIÁVEL
ALTER TABLE public.titulo 
ADD COLUMN IF NOT EXISTS aguardando_valor BOOLEAN NOT NULL DEFAULT false;

-- 8. ÍNDICES DE DESEMPENHO
CREATE INDEX IF NOT EXISTS idx_recorrencia_proxima ON public.recorrencia(proxima_competencia, status) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_recorrencia_ocorrencia_comp ON public.recorrencia_ocorrencia(recorrencia_id, competencia);
CREATE INDEX IF NOT EXISTS idx_titulo_aguardando_valor ON public.titulo(aguardando_valor) WHERE aguardando_valor = true;
