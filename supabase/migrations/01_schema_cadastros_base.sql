-- ⚠ ARQUIVO HISTÓRICO — NÃO EXECUTE.
-- Consolidado em ../schema_completo.sql (banco novo) e em 08_correcoes_consistencia.sql (banco existente).
-- Faltam aqui: pessoa.data_nascimento, pessoa.categoria_fornecedor, e as folhas 3.1.xx a 6.1.xx nascem com nivel/parent errados.
-- ==============================================================================
-- MIGRATION 01: SCHEMA BASE DO FINANCEIRO (ETAPA 1/5)
-- ERP Melhor Gestão
-- ==============================================================================

-- 1. TABELA PLANO DE CONTAS (Estrutura em Árvore)
CREATE TABLE IF NOT EXISTS plano_conta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  parent_id UUID REFERENCES plano_conta(id) ON DELETE RESTRICT,
  natureza TEXT NOT NULL CHECK (natureza IN ('receita', 'custo', 'despesa', 'investimento')),
  nivel INT NOT NULL CHECK (nivel > 0),
  aceita_lancamento BOOLEAN DEFAULT true NOT NULL,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index para buscas na árvore
CREATE INDEX IF NOT EXISTS idx_plano_conta_parent ON plano_conta(parent_id);
CREATE INDEX IF NOT EXISTS idx_plano_conta_codigo ON plano_conta(codigo);

-- 2. TABELA CENTRO DE CUSTOS (Estrutura em Árvore)
CREATE TABLE IF NOT EXISTS centro_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  parent_id UUID REFERENCES centro_custo(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('obra', 'administrativo', 'frota', 'comercial')),
  nivel INT NOT NULL CHECK (nivel > 0),
  aceita_lancamento BOOLEAN DEFAULT true NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_centro_custo_parent ON centro_custo(parent_id);

-- 3. TABELA PESSOA (Clientes & Fornecedores Unificados)
CREATE TABLE IF NOT EXISTS pessoa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf_cnpj TEXT UNIQUE NOT NULL,
  tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('F', 'J')),
  nome TEXT NOT NULL,
  nome_fantasia TEXT,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  is_cliente BOOLEAN DEFAULT false NOT NULL,
  is_fornecedor BOOLEAN DEFAULT false NOT NULL,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  chave_pix TEXT,
  plano_conta_padrao_id UUID REFERENCES plano_conta(id) ON DELETE SET NULL,
  condicao_pagamento_padrao INT DEFAULT 0, -- em dias
  observacao TEXT,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Regra de Ouro: Pelo menos uma das flags deve ser verdadeira
  CONSTRAINT chk_pessoa_tipo_flag CHECK (is_cliente = true OR is_fornecedor = true)
);

CREATE INDEX IF NOT EXISTS idx_pessoa_cpf_cnpj ON pessoa(cpf_cnpj);

-- 4. TABELA CONTA BANCÁRIA
CREATE TABLE IF NOT EXISTS conta_bancaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'caixa', 'aplicacao')),
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  saldo_inicial NUMERIC(15,2) DEFAULT 0.00 NOT NULL,
  data_saldo_inicial DATE DEFAULT CURRENT_DATE NOT NULL,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- SEED OBRIGATÓRIO: ESTRUTURA DO PLANO DE CONTAS
-- ==============================================================================

-- Inserção de Nós Principais Nível 1
INSERT INTO plano_conta (id, codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('10000000-0000-0000-0000-000000000001', '1', 'RECEITAS', NULL, 'receita', 1, false),
  ('20000000-0000-0000-0000-000000000002', '2', 'CUSTOS DIRETOS', NULL, 'custo', 1, false),
  ('30000000-0000-0000-0000-000000000003', '3', 'DESPESAS ADMINISTRATIVAS', NULL, 'despesa', 1, false),
  ('40000000-0000-0000-0000-000000000004', '4', 'DESPESAS FINANCEIRAS', NULL, 'despesa', 1, false),
  ('50000000-0000-0000-0000-000000000005', '5', 'IMPOSTOS', NULL, 'despesa', 1, false),
  ('60000000-0000-0000-0000-000000000006', '6', 'INVESTIMENTOS', NULL, 'investimento', 1, false)
ON CONFLICT (codigo) DO NOTHING;

-- Nível 2 (Filhos de 1 RECEITAS)
INSERT INTO plano_conta (id, codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('11000000-0000-0000-0000-000000000011', '1.1', 'Receita operacional', '10000000-0000-0000-0000-000000000001', 'receita', 2, false),
  ('12000000-0000-0000-0000-000000000012', '1.2', 'Receita não operacional', '10000000-0000-0000-0000-000000000001', 'receita', 2, false)
ON CONFLICT (codigo) DO NOTHING;

-- Nível 3 (Folhas de 1.1 e 1.2)
INSERT INTO plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('1.1.01', 'Locação de equipamentos', '11000000-0000-0000-0000-000000000011', 'receita', 3, true),
  ('1.1.02', 'Empreitada', '11000000-0000-0000-0000-000000000011', 'receita', 3, true),
  ('1.1.03', 'Venda de material', '11000000-0000-0000-0000-000000000011', 'receita', 3, true),
  ('1.2.01', 'Venda de ativo', '12000000-0000-0000-0000-000000000012', 'receita', 3, true),
  ('1.2.02', 'Rendimento de aplicação', '12000000-0000-0000-0000-000000000012', 'receita', 3, true)
ON CONFLICT (codigo) DO NOTHING;

-- Nível 2 (Filhos de 2 CUSTOS DIRETOS)
INSERT INTO plano_conta (id, codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('21000000-0000-0000-0000-000000000021', '2.1', 'Mão de obra', '20000000-0000-0000-0000-000000000002', 'custo', 2, false),
  ('22000000-0000-0000-0000-000000000022', '2.2', 'Material', '20000000-0000-0000-0000-000000000002', 'custo', 2, false),
  ('23000000-0000-0000-0000-000000000023', '2.3', 'Equipamento', '20000000-0000-0000-0000-000000000002', 'custo', 2, false)
ON CONFLICT (codigo) DO NOTHING;

-- Nível 3 (Folhas de 2.1, 2.2, 2.3)
INSERT INTO plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('2.1.01', 'Salários de obra', '21000000-0000-0000-0000-000000000021', 'custo', 3, true),
  ('2.1.02', 'Encargos', '21000000-0000-0000-0000-000000000021', 'custo', 3, true),
  ('2.1.03', 'Empreiteiros terceiros', '21000000-0000-0000-0000-000000000021', 'custo', 3, true),
  ('2.2.01', 'Material de construção', '22000000-0000-0000-0000-000000000022', 'custo', 3, true),
  ('2.2.02', 'Material elétrico', '22000000-0000-0000-0000-000000000022', 'custo', 3, true),
  ('2.3.01', 'Locação de terceiros', '23000000-0000-0000-0000-000000000023', 'custo', 3, true),
  ('2.3.02', 'Manutenção de máquinas', '23000000-0000-0000-0000-000000000023', 'custo', 3, true),
  ('2.3.03', 'Combustível', '23000000-0000-0000-0000-000000000023', 'custo', 3, true)
ON CONFLICT (codigo) DO NOTHING;

-- Folhas de 3 DESPESAS ADMINISTRATIVAS
INSERT INTO plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('3.1.01', 'Salários administrativos', '30000000-0000-0000-0000-000000000003', 'despesa', 2, true),
  ('3.1.02', 'Aluguel', '30000000-0000-0000-0000-000000000003', 'despesa', 2, true),
  ('3.1.03', 'Contabilidade e jurídico', '30000000-0000-0000-0000-000000000003', 'despesa', 2, true),
  ('3.1.04', 'Software e telefonia', '30000000-0000-0000-0000-000000000003', 'despesa', 2, true)
ON CONFLICT (codigo) DO NOTHING;

-- Folhas de 4 DESPESAS FINANCEIRAS
INSERT INTO plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('4.1.01', 'Juros e multas pagos', '40000000-0000-0000-0000-000000000004', 'despesa', 2, true),
  ('4.1.02', 'Tarifas bancárias', '40000000-0000-0000-0000-000000000004', 'despesa', 2, true),
  ('4.1.03', 'IOF', '40000000-0000-0000-0000-000000000004', 'despesa', 2, true)
ON CONFLICT (codigo) DO NOTHING;

-- Folhas de 5 IMPOSTOS
INSERT INTO plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('5.1.01', 'Simples Nacional/DAS', '50000000-0000-0000-0000-000000000005', 'despesa', 2, true),
  ('5.1.02', 'ISS retido', '50000000-0000-0000-0000-000000000005', 'despesa', 2, true),
  ('5.1.03', 'INSS retido', '50000000-0000-0000-0000-000000000005', 'despesa', 2, true)
ON CONFLICT (codigo) DO NOTHING;

-- Folhas de 6 INVESTIMENTOS
INSERT INTO plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('6.1.01', 'Aquisição de máquina', '60000000-0000-0000-0000-000000000006', 'investimento', 2, true),
  ('6.1.02', 'Aquisição de veículo', '60000000-0000-0000-0000-000000000006', 'investimento', 2, true)
ON CONFLICT (codigo) DO NOTHING;
