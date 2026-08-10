-- ⚠ ARQUIVO HISTÓRICO — NÃO EXECUTE.
-- Consolidado em ../schema_completo.sql (banco novo) e em 08_correcoes_consistencia.sql (banco existente).
-- movimento.parcela_id nasce NOT NULL (quebra lançamento avulso) e created_by tem DEFAULT fixo num usuário específico.
-- ==============================================================================
-- MIGRATION 03: TABELA DE MOVIMENTO, BAIXAS E ESTORNOS (ETAPA 3/5)
-- ERP Melhor Gestão
-- ==============================================================================

-- 1. TABELA MOVIMENTO (Baixa Efetiva de Caixa)
CREATE TABLE IF NOT EXISTS movimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id UUID NOT NULL REFERENCES titulo_parcela(id) ON DELETE RESTRICT,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_pago NUMERIC(15,2) NOT NULL CHECK (valor_pago > 0),
  juros NUMERIC(15,2) DEFAULT 0.00 NOT NULL CHECK (juros >= 0),
  multa NUMERIC(15,2) DEFAULT 0.00 NOT NULL CHECK (multa >= 0),
  desconto NUMERIC(15,2) DEFAULT 0.00 NOT NULL CHECK (desconto >= 0),
  
  -- valor_liquido = valor_pago + juros + multa - desconto
  valor_liquido NUMERIC(15,2) NOT NULL,
  
  conta_bancaria_id UUID NOT NULL REFERENCES conta_bancaria(id) ON DELETE RESTRICT,
  forma_pagamento TEXT NOT NULL CHECK (
    forma_pagamento IN ('dinheiro', 'pix', 'ted', 'boleto', 'cartao', 'cheque', 'permuta')
  ),
  numero_documento TEXT,
  observacao TEXT,
  
  -- Estorno Rastreável
  estornado BOOLEAN DEFAULT false NOT NULL,
  estornado_em TIMESTAMPTZ,
  estornado_por TEXT,
  motivo_estorno TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by TEXT DEFAULT 'Fabrício (Administrador)'
);

CREATE INDEX IF NOT EXISTS idx_movimento_parcela ON movimento(parcela_id);
CREATE INDEX IF NOT EXISTS idx_movimento_conta ON movimento(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_movimento_data ON movimento(data_pagamento);

-- 2. RECRIAÇÃO DA VIEW DE PARCELAS DETALHADAS COM SOMA DE BAIXAS REAIS
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
  pc.natureza AS plano_conta_natureza,
  t.numero_documento,
  t.serie,
  t.descricao AS titulo_descricao,
  t.data_emissao,
  t.data_competencia,
  tp.numero AS parcela_numero,
  t.qtd_parcelas,
  tp.data_vencimento,
  tp.valor AS parcela_valor,
  
  -- Regra de Ouro #3: Soma apenas de movimentos NÃO estornados
  COALESCE(m_sum.total_pago, 0.00) AS valor_baixado,
  tp.valor - COALESCE(m_sum.total_pago, 0.00) AS saldo,
  
  -- Regra de Ouro #4: Status derivado automaticamente
  CASE 
    WHEN tp.ativo = false THEN 'cancelado'
    WHEN (tp.valor - COALESCE(m_sum.total_pago, 0.00)) <= 0.005 THEN 'pago'
    WHEN COALESCE(m_sum.total_pago, 0.00) > 0 AND (tp.valor - COALESCE(m_sum.total_pago, 0.00)) > 0.005 THEN 'parcial'
    WHEN (tp.valor - COALESCE(m_sum.total_pago, 0.00)) > 0.005 AND tp.data_vencimento < CURRENT_DATE THEN 'vencido'
    ELSE 'aberto'
  END AS status_parcela,
  
  CASE 
    WHEN (tp.valor - COALESCE(m_sum.total_pago, 0.00)) > 0.005 AND tp.data_vencimento < CURRENT_DATE 
    THEN (CURRENT_DATE - tp.data_vencimento)
    ELSE 0
  END AS dias_atraso,
  
  tp.ativo
FROM titulo_parcela tp
JOIN titulo t ON tp.titulo_id = t.id
JOIN pessoa p ON t.pessoa_id = p.id
JOIN plano_conta pc ON t.plano_conta_id = pc.id
LEFT JOIN (
  SELECT parcela_id, SUM(valor_pago) AS total_pago
  FROM movimento
  WHERE estornado = false
  GROUP BY parcela_id
) m_sum ON tp.id = m_sum.parcela_id;
