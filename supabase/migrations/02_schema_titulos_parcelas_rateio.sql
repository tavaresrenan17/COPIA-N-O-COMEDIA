-- ⚠ ARQUIVO HISTÓRICO — NÃO EXECUTE.
-- Consolidado em ../schema_completo.sql (banco novo) e em 08_correcoes_consistencia.sql (banco existente).
-- Faltam aqui: titulo.codigo, grupo/linha de gestão, created_by/updated_by. A view criada aqui é antiga e conflita com a atual.
-- ==============================================================================
-- MIGRATION 02: TÍTULOS, PARCELAS E RATEIO POR CENTRO DE CUSTO (ETAPA 2/5)
-- ERP Melhor Gestão
-- ==============================================================================

-- 1. SEED: REGISTRO "NÃO ALOCADO" NO CENTRO DE CUSTOS (Caso não seja informado rateio)
INSERT INTO centro_custo (id, codigo, nome, parent_id, tipo, nivel, aceita_lancamento, ativo) VALUES
  ('99999999-9999-9999-9999-999999999999', 'CC-999', 'Não alocado', NULL, 'administrativo', 1, true, true)
ON CONFLICT (codigo) DO NOTHING;

-- 2. TABELA TÍTULO (Motor Financeiro Único para Pagar 'P' e Receber 'R')
CREATE TABLE IF NOT EXISTS titulo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo CHAR(1) NOT NULL CHECK (tipo IN ('P', 'R')),
  pessoa_id UUID NOT NULL REFERENCES pessoa(id) ON DELETE RESTRICT,
  plano_conta_id UUID NOT NULL REFERENCES plano_conta(id) ON DELETE RESTRICT,
  numero_documento TEXT,
  serie TEXT,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_competencia DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_bruto NUMERIC(15,2) NOT NULL CHECK (valor_bruto > 0),
  qtd_parcelas INT DEFAULT 1 NOT NULL CHECK (qtd_parcelas > 0),
  descricao TEXT,
  observacao TEXT,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_titulo_tipo ON titulo(tipo);
CREATE INDEX IF NOT EXISTS idx_titulo_pessoa ON titulo(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_titulo_plano_conta ON titulo(plano_conta_id);

-- 3. TABELA TÍTULO PARCELA
CREATE TABLE IF NOT EXISTS titulo_parcela (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id UUID NOT NULL REFERENCES titulo(id) ON DELETE CASCADE,
  numero INT NOT NULL CHECK (numero > 0),
  data_vencimento DATE NOT NULL,
  valor NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  observacao TEXT,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT uq_titulo_parcela_numero UNIQUE (titulo_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_parcela_vencimento ON titulo_parcela(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcela_titulo ON titulo_parcela(titulo_id);

-- 4. TABELA TÍTULO RATEIO (Rateio por Centro de Custo)
CREATE TABLE IF NOT EXISTS titulo_rateio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id UUID NOT NULL REFERENCES titulo_parcela(id) ON DELETE CASCADE,
  centro_custo_id UUID NOT NULL REFERENCES centro_custo(id) ON DELETE RESTRICT,
  percentual NUMERIC(7,4) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  valor NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT uq_parcela_centro_custo UNIQUE (parcela_id, centro_custo_id)
);

-- ==============================================================================
-- VIEW MATERIALIZADA / CONSULTA DE PARCELAS COM STATUS DERIVADO
-- ==============================================================================

CREATE OR REPLACE VIEW view_parcelas_detalhadas AS
SELECT 
  tp.id AS parcela_id,
  tp.titulo_id,
  t.tipo,
  t.pessoa_id,
  p.nome AS pessoa_nome,
  p.cpf_cnpj AS pessoa_cpf_cnpj,
  t.plano_conta_id,
  pc.codigo AS plano_conta_codigo,
  pc.nome AS plano_conta_nome,
  t.numero_documento,
  t.serie,
  t.descricao AS titulo_descricao,
  t.data_emissao,
  t.data_competencia,
  tp.numero AS parcela_numero,
  t.qtd_parcelas,
  tp.data_vencimento,
  tp.valor AS parcela_valor,
  
  -- Cálculo de Baixa (Na etapa 4 será acoplado à tabela movimento)
  COALESCE(0.00, 0.00) AS valor_baixado,
  tp.valor - COALESCE(0.00, 0.00) AS saldo,
  
  -- Status Derivado da Parcela
  CASE 
    WHEN tp.ativo = false THEN 'cancelado'
    WHEN (tp.valor - COALESCE(0.00, 0.00)) <= 0.005 THEN 'pago'
    WHEN COALESCE(0.00, 0.00) > 0 AND (tp.valor - COALESCE(0.00, 0.00)) > 0.005 THEN 'parcial'
    WHEN (tp.valor - COALESCE(0.00, 0.00)) > 0.005 AND tp.data_vencimento < CURRENT_DATE THEN 'vencido'
    ELSE 'aberto'
  END AS status_parcela,
  
  -- Dias de Atraso
  CASE 
    WHEN (tp.valor - COALESCE(0.00, 0.00)) > 0.005 AND tp.data_vencimento < CURRENT_DATE 
    THEN (CURRENT_DATE - tp.data_vencimento)
    ELSE 0
  END AS dias_atraso,
  
  tp.ativo
FROM titulo_parcela tp
JOIN titulo t ON tp.titulo_id = t.id
JOIN pessoa p ON t.pessoa_id = p.id
JOIN plano_conta pc ON t.plano_conta_id = pc.id;
