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

-- Plano financeiro do cliente: 139 contas em 3 níveis.
--   nível 1 → 2 raízes · nível 2 → 16 grupos · nível 3 → 121 folhas
-- Natureza por grupo raiz: tudo em "1." é receita, tudo em "2." é despesa.
-- O pai é resolvido pelo CÓDIGO, então a ordem dos blocos importa.

-- Nível 1
INSERT INTO plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('1', 'ENTRADAS/RECEITAS', NULL, 'receita', 1, false),
  ('2', 'SAÍDAS / CUSTOS / DESPESAS', NULL, 'despesa', 1, false)
ON CONFLICT (codigo) DO NOTHING;

-- Nível 2
INSERT INTO plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('1.01', 'RECEITA OPERACIONAL', (SELECT id FROM plano_conta WHERE codigo = '1'), 'receita', 2, false),
  ('1.02', 'EMPRÉSTIMOS E FINANCIAMENTOS', (SELECT id FROM plano_conta WHERE codigo = '1'), 'receita', 2, false),
  ('1.03', 'VENDAS E LOCAÇÕES', (SELECT id FROM plano_conta WHERE codigo = '1'), 'receita', 2, false),
  ('1.04', 'ENTRADA INTERNA', (SELECT id FROM plano_conta WHERE codigo = '1'), 'receita', 2, false),
  ('1.05', 'DESCONTOS', (SELECT id FROM plano_conta WHERE codigo = '1'), 'receita', 2, false),
  ('2.01', 'MÃO DE OBRA E ENCARGOS', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false),
  ('2.02', 'AUTUAÇÕES E INFRAÇÕES', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false),
  ('2.03', 'CONTAS DE OBRAS', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false),
  ('2.04', 'SERVIÇOS ESPECIALIZADOS', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false),
  ('2.05', 'DESPESAS DOS SÓCIOS', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false),
  ('2.06', 'DESPESAS FINANCEIRAS', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false),
  ('2.07', 'CONTENCIOSO', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false),
  ('2.08', 'DÍVIDAS RECONHECIDAS', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false),
  ('2.10', 'DESPESAS TRIBUTÁRIAS', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false),
  ('2.11', 'TRIBUTOS E ENCARGOS DA FOLHA DE PAGAMENTO', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false),
  ('2.12', 'SAÍDA INTERNA', (SELECT id FROM plano_conta WHERE codigo = '2'), 'despesa', 2, false)
ON CONFLICT (codigo) DO NOTHING;

-- Nível 3
INSERT INTO plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('1.01.01', 'Receita de Serviços', (SELECT id FROM plano_conta WHERE codigo = '1.01'), 'receita', 3, true),
  ('1.01.02', 'Sinal do contrato com cliente', (SELECT id FROM plano_conta WHERE codigo = '1.01'), 'receita', 3, true),
  ('1.01.03', 'Entrada do contrato', (SELECT id FROM plano_conta WHERE codigo = '1.01'), 'receita', 3, true),
  ('1.01.04', '(-)ISS s/ Serviços', (SELECT id FROM plano_conta WHERE codigo = '1.01'), 'receita', 3, true),
  ('1.01.05', '(-)INSS s/ Serviços', (SELECT id FROM plano_conta WHERE codigo = '1.01'), 'receita', 3, true),
  ('1.02.01', 'Aporte de Sócio', (SELECT id FROM plano_conta WHERE codigo = '1.02'), 'receita', 3, true),
  ('1.02.02', 'Empréstimo terceiros', (SELECT id FROM plano_conta WHERE codigo = '1.02'), 'receita', 3, true),
  ('1.03.01', 'Locação de Equipamentos/Máquinas', (SELECT id FROM plano_conta WHERE codigo = '1.03'), 'receita', 3, true),
  ('1.03.02', 'Venda de materiais de obra', (SELECT id FROM plano_conta WHERE codigo = '1.03'), 'receita', 3, true),
  ('1.03.03', 'Venda de ferramentas', (SELECT id FROM plano_conta WHERE codigo = '1.03'), 'receita', 3, true),
  ('1.04.01', 'Recebimento interno', (SELECT id FROM plano_conta WHERE codigo = '1.04'), 'receita', 3, true),
  ('1.05.01', '(-)Descontar do Funcionário', (SELECT id FROM plano_conta WHERE codigo = '1.05'), 'receita', 3, true),
  ('2.01.01', 'Salários e ordenados', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.02', 'Diárias combinadas', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.03', 'Serviços Terceirizados e Empreiteiros', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.04', 'Férias', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.05', '13º Salário', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.06', 'Bonificações', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.07', 'Salário Família', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.10', 'Alimentação', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.11', 'Transporte', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.12', 'Custeio de Treinamento', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.13', 'Assistência médica', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.14', 'Custo de Rescisão', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.15', 'Seguro de vida', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.16', 'Uniformes e EPI''s', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.17', 'Medicina Ocupacional', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.18', 'Horas extras', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.19', 'Adiantamento e Vales Diaristas', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.20', 'Pagamento Empresas', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.21', 'Salários CLT', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.22', 'Salários PJ', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.23', 'Salários Estagiários', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.24', 'Adiantamento e Vales PJ', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.25', 'Adiantamento e Vales CLT', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.01.26', 'Seguro de vida dos funcionários', (SELECT id FROM plano_conta WHERE codigo = '2.01'), 'despesa', 3, true),
  ('2.02.01', 'Multas e Correções por Atraso de no pagamento', (SELECT id FROM plano_conta WHERE codigo = '2.02'), 'despesa', 3, true),
  ('2.02.02', 'Autuações Fiscais', (SELECT id FROM plano_conta WHERE codigo = '2.02'), 'despesa', 3, true),
  ('2.02.03', 'Infrações de Trânsito', (SELECT id FROM plano_conta WHERE codigo = '2.02'), 'despesa', 3, true),
  ('2.02.04', 'Infrações Ambientais (Ruído, Limpeza, Licenças)', (SELECT id FROM plano_conta WHERE codigo = '2.02'), 'despesa', 3, true),
  ('2.03.01', 'Materiais de Obra', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.02', 'Aquisição de ferramentas', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.03', 'Aluguéis de imóveis', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.04', 'Condomínio', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.05', 'Água e esgoto', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.06', 'Energia Elétrica', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.07', 'Gás', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.08', 'Aquisição de móveis e utensílios', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.09', 'Material de Escritório', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.10', 'Material de Limpeza', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.11', 'Locação de ferramentas', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.12', 'Abastecimento', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.13', 'Sinalização de obra', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.14', 'Despesas com Cartórios e Legalizações', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.15', 'Fretes e Entrega', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.16', 'Equipamentos Eletrônicos', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.17', 'Provedores de Internet', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.18', 'Licenças de Softwares', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.19', 'Manutenção de Veículos', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.20', 'Aquisição de Equipamentos', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.21', 'Aquisição de Veículos', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.22', 'Seguro de Veículos', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.23', 'Pedágio/Estacionamento', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.24', 'Locação de Veículo', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.25', 'Passagens', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.26', 'Hospedagem', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.27', 'Custo de vida Engenheiro(a)', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.28', 'Projetos', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.29', 'Telefone', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.30', 'Eventos da empresa', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.31', 'Locação de Máquinas', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.32', 'Reembolso de KM', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.33', 'Licença Médica', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.34', 'Manutenção Geral', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.35', 'Reembolso Geral', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.36', 'Equipamentos', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.37', 'Caixinha', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.03.38', 'Despesas Veiculos', (SELECT id FROM plano_conta WHERE codigo = '2.03'), 'despesa', 3, true),
  ('2.04.01', 'Assessoria Jurídica', (SELECT id FROM plano_conta WHERE codigo = '2.04'), 'despesa', 3, true),
  ('2.04.02', 'Assessoria Contábil', (SELECT id FROM plano_conta WHERE codigo = '2.04'), 'despesa', 3, true),
  ('2.04.03', 'Assessoria R.H', (SELECT id FROM plano_conta WHERE codigo = '2.04'), 'despesa', 3, true),
  ('2.04.04', 'Consultoria em T.I', (SELECT id FROM plano_conta WHERE codigo = '2.04'), 'despesa', 3, true),
  ('2.04.05', 'Assessoria de Qualidade', (SELECT id FROM plano_conta WHERE codigo = '2.04'), 'despesa', 3, true),
  ('2.04.06', 'Assessoria de Marketing', (SELECT id FROM plano_conta WHERE codigo = '2.04'), 'despesa', 3, true),
  ('2.04.07', 'Assessoria de Dados', (SELECT id FROM plano_conta WHERE codigo = '2.04'), 'despesa', 3, true),
  ('2.04.08', 'Assessoria de Segurança', (SELECT id FROM plano_conta WHERE codigo = '2.04'), 'despesa', 3, true),
  ('2.05.01', 'Retirada de Sócios', (SELECT id FROM plano_conta WHERE codigo = '2.05'), 'despesa', 3, true),
  ('2.05.02', 'Contas Pessoais', (SELECT id FROM plano_conta WHERE codigo = '2.05'), 'despesa', 3, true),
  ('2.05.03', 'Devolução de aporte', (SELECT id FROM plano_conta WHERE codigo = '2.05'), 'despesa', 3, true),
  ('2.05.04', 'Investimentos em conjunto', (SELECT id FROM plano_conta WHERE codigo = '2.05'), 'despesa', 3, true),
  ('2.06.01', 'Tarifas Diversas', (SELECT id FROM plano_conta WHERE codigo = '2.06'), 'despesa', 3, true),
  ('2.06.02', 'Taxa de Aquisição de Crédito', (SELECT id FROM plano_conta WHERE codigo = '2.06'), 'despesa', 3, true),
  ('2.06.03', 'Juros sobre Empréstimos', (SELECT id FROM plano_conta WHERE codigo = '2.06'), 'despesa', 3, true),
  ('2.06.04', 'Multas e Acréscimos', (SELECT id FROM plano_conta WHERE codigo = '2.06'), 'despesa', 3, true),
  ('2.06.05', 'IPTU', (SELECT id FROM plano_conta WHERE codigo = '2.06'), 'despesa', 3, true),
  ('2.06.06', 'Quitação empréstimo', (SELECT id FROM plano_conta WHERE codigo = '2.06'), 'despesa', 3, true),
  ('2.07.01', 'Ações Trabalhistas', (SELECT id FROM plano_conta WHERE codigo = '2.07'), 'despesa', 3, true),
  ('2.07.02', 'Ações Civis Diversas', (SELECT id FROM plano_conta WHERE codigo = '2.07'), 'despesa', 3, true),
  ('2.08.01', 'Dívida com Funcionário', (SELECT id FROM plano_conta WHERE codigo = '2.08'), 'despesa', 3, true),
  ('2.08.02', 'Dívida com Governo', (SELECT id FROM plano_conta WHERE codigo = '2.08'), 'despesa', 3, true),
  ('2.08.03', 'Dívida com Banco', (SELECT id FROM plano_conta WHERE codigo = '2.08'), 'despesa', 3, true),
  ('2.08.04', 'Dívida com Fornecedor', (SELECT id FROM plano_conta WHERE codigo = '2.08'), 'despesa', 3, true),
  ('2.10.01', 'GUIA PIS', (SELECT id FROM plano_conta WHERE codigo = '2.10'), 'despesa', 3, true),
  ('2.10.02', 'GUIA COFINS', (SELECT id FROM plano_conta WHERE codigo = '2.10'), 'despesa', 3, true),
  ('2.10.03', 'GUIA ISS', (SELECT id FROM plano_conta WHERE codigo = '2.10'), 'despesa', 3, true),
  ('2.10.04', 'GUIA IRPJ', (SELECT id FROM plano_conta WHERE codigo = '2.10'), 'despesa', 3, true),
  ('2.10.05', 'GUIA CSLL', (SELECT id FROM plano_conta WHERE codigo = '2.10'), 'despesa', 3, true),
  ('2.10.06', 'GUIA DAS (SIMPLES)', (SELECT id FROM plano_conta WHERE codigo = '2.10'), 'despesa', 3, true),
  ('2.10.07', 'GUIA MEI', (SELECT id FROM plano_conta WHERE codigo = '2.10'), 'despesa', 3, true),
  ('2.11.01', 'INSS Funcionários', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.11.02', 'INSS Patronal (Desoneração)', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.11.03', 'FGTS', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.11.04', 'FGTS Rescisório', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.11.05', 'IRRF Terceiros PF (0588)', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.11.06', 'IRRF Terceiros PJ (1708)', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.11.07', 'Contribuição Sindical Confederativa', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.11.08', 'Contribuição Sindical Patronal', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.11.09', 'Entidades/Conselhos de Classe (CREA, CRA)', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.11.10', 'Cofre Leis Sociais', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.11.11', 'Guia DARF', (SELECT id FROM plano_conta WHERE codigo = '2.11'), 'despesa', 3, true),
  ('2.12.01', 'Saída interna', (SELECT id FROM plano_conta WHERE codigo = '2.12'), 'despesa', 3, true)
ON CONFLICT (codigo) DO NOTHING;
