-- ==============================================================================
-- ERP "MELHOR GESTÃO" — SCHEMA COMPLETO DO BANCO DE DADOS (SUPABASE / POSTGRESQL)
-- ==============================================================================
-- FONTE ÚNICA DA VERDADE do banco. Reflete migrations 01→08 já consolidadas.
--
-- Quando usar cada arquivo:
--   • Banco NOVO / vazio ............ execute SOMENTE este arquivo.
--   • Banco JÁ EXISTENTE ............ execute migrations/08_correcoes_consistencia.sql
--
-- Os arquivos migrations/01..07 são histórico e NÃO devem ser reexecutados:
-- eles contêm definições conflitantes entre si (ver cabeçalho de cada um).
--
-- Como executar: Supabase → SQL Editor → New Query → colar → Run.
-- O script é idempotente: pode rodar mais de uma vez sem erro.
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 0. FUNÇÃO COMPARTILHADA DE updated_at
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. PLANO DE CONTAS (árvore: nível 1 → 2 → 3)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plano_conta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  parent_id UUID REFERENCES public.plano_conta(id) ON DELETE RESTRICT,
  natureza TEXT NOT NULL CHECK (natureza IN ('receita', 'custo', 'despesa', 'investimento')),
  nivel INT NOT NULL CHECK (nivel > 0),
  aceita_lancamento BOOLEAN DEFAULT true NOT NULL,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plano_conta_parent ON public.plano_conta(parent_id);
CREATE INDEX IF NOT EXISTS idx_plano_conta_codigo ON public.plano_conta(codigo);

-- ------------------------------------------------------------------------------
-- 2. CENTRO DE CUSTOS (árvore)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.centro_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  parent_id UUID REFERENCES public.centro_custo(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('obra', 'administrativo', 'frota', 'comercial')),
  nivel INT NOT NULL CHECK (nivel > 0),
  aceita_lancamento BOOLEAN DEFAULT true NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_centro_custo_periodo CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_centro_custo_parent ON public.centro_custo(parent_id);

-- Centro de custo padrão usado quando o lançamento não tem rateio definido.
-- Precisa permanecer ATIVO: o app filtra ativo = true ao listar centros de custo.
INSERT INTO public.centro_custo (id, codigo, nome, parent_id, tipo, nivel, aceita_lancamento, ativo) VALUES
  ('99999999-9999-9999-9999-999999999999', 'CC-999', 'Não alocado', NULL, 'administrativo', 1, true, true)
ON CONFLICT (codigo) DO UPDATE SET ativo = true;

-- ------------------------------------------------------------------------------
-- 3. PESSOA (Clientes & Fornecedores unificados)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pessoa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf_cnpj TEXT UNIQUE NOT NULL,
  tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('F', 'J')),
  nome TEXT NOT NULL,
  nome_fantasia TEXT,
  inscricao_estadual TEXT,
  data_nascimento DATE,
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
  categoria_fornecedor TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  chave_pix TEXT,
  plano_conta_padrao_id UUID REFERENCES public.plano_conta(id) ON DELETE SET NULL,
  condicao_pagamento_padrao INT DEFAULT 0,   -- em dias
  observacao TEXT,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Regra de Ouro: pelo menos uma das flags precisa ser verdadeira
  CONSTRAINT chk_pessoa_tipo_flag CHECK (is_cliente = true OR is_fornecedor = true)
);

CREATE INDEX IF NOT EXISTS idx_pessoa_cpf_cnpj ON public.pessoa(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_pessoa_flags    ON public.pessoa(is_cliente, is_fornecedor) WHERE ativo = true;

-- ------------------------------------------------------------------------------
-- 4. CONTA BANCÁRIA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conta_bancaria (
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

-- ------------------------------------------------------------------------------
-- 5. GRUPO E LINHA DE GESTÃO
-- ------------------------------------------------------------------------------
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
  -- Código é único DENTRO do grupo, não globalmente: cada grupo pode ter sua linha 001
  CONSTRAINT uq_linha_gestao_grupo_codigo UNIQUE (grupo_gestao_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_linha_gestao_grupo ON public.linha_gestao(grupo_gestao_id);
CREATE INDEX IF NOT EXISTS idx_linha_gestao_centro_custo ON public.linha_gestao(centro_custo_id);

-- ------------------------------------------------------------------------------
-- 6. TÍTULO (motor financeiro único: 'P' = pagar, 'R' = receber)
-- ------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.titulo_codigo_seq AS BIGINT MINVALUE 1;

CREATE TABLE IF NOT EXISTS public.titulo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sequencial de 6 dígitos gerado pelo banco (nunca por COUNT(*) no app)
  codigo TEXT UNIQUE NOT NULL DEFAULT lpad(nextval('public.titulo_codigo_seq')::TEXT, 6, '0'),
  tipo CHAR(1) NOT NULL CHECK (tipo IN ('P', 'R')),
  pessoa_id UUID NOT NULL REFERENCES public.pessoa(id) ON DELETE RESTRICT,
  grupo_gestao_id UUID REFERENCES public.grupo_gestao(id) ON DELETE SET NULL,
  linha_gestao_id UUID REFERENCES public.linha_gestao(id) ON DELETE SET NULL,
  plano_conta_id UUID NOT NULL REFERENCES public.plano_conta(id) ON DELETE RESTRICT,
  numero_documento TEXT,
  serie TEXT,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_competencia DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_bruto NUMERIC(15,2) NOT NULL DEFAULT 0,
  qtd_parcelas INT DEFAULT 1 NOT NULL CHECK (qtd_parcelas > 0),
  descricao TEXT,
  observacao TEXT,
  aguardando_valor BOOLEAN NOT NULL DEFAULT false,
  recorrencia_id UUID,                    -- FK adicionada na seção 12
  recorrencia_periodo TEXT,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Título de recorrência de valor variável nasce sem valor definido
  CONSTRAINT chk_titulo_valor_bruto CHECK (valor_bruto > 0 OR aguardando_valor = true)
);

CREATE INDEX IF NOT EXISTS idx_titulo_tipo             ON public.titulo(tipo);
CREATE INDEX IF NOT EXISTS idx_titulo_pessoa           ON public.titulo(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_titulo_plano_conta      ON public.titulo(plano_conta_id);
CREATE INDEX IF NOT EXISTS idx_titulo_competencia      ON public.titulo(data_competencia);
CREATE INDEX IF NOT EXISTS idx_titulo_aguardando_valor ON public.titulo(aguardando_valor) WHERE aguardando_valor = true;

-- Coerência tipo × natureza: 'R' exige conta de receita, 'P' proíbe conta de receita
CREATE OR REPLACE FUNCTION public.valida_natureza_titulo()
RETURNS TRIGGER AS $$
DECLARE
  v_natureza TEXT;
BEGIN
  SELECT natureza INTO v_natureza FROM public.plano_conta WHERE id = NEW.plano_conta_id;

  IF NEW.tipo = 'R' AND v_natureza <> 'receita' THEN
    RAISE EXCEPTION 'Título a RECEBER exige plano de contas de natureza "receita" (recebido: "%").', v_natureza
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.tipo = 'P' AND v_natureza = 'receita' THEN
    RAISE EXCEPTION 'Título a PAGAR não pode usar plano de contas de natureza "receita".'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_valida_natureza_titulo ON public.titulo;
CREATE TRIGGER trg_valida_natureza_titulo
  BEFORE INSERT OR UPDATE OF tipo, plano_conta_id ON public.titulo
  FOR EACH ROW EXECUTE FUNCTION public.valida_natureza_titulo();

-- ------------------------------------------------------------------------------
-- 7. TÍTULO PARCELA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.titulo_parcela (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id UUID NOT NULL REFERENCES public.titulo(id) ON DELETE CASCADE,
  numero INT NOT NULL CHECK (numero > 0),
  data_vencimento DATE NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  observacao TEXT,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_titulo_parcela_numero UNIQUE (titulo_id, numero),
  CONSTRAINT chk_titulo_parcela_valor CHECK (valor >= 0)
);

CREATE INDEX IF NOT EXISTS idx_parcela_vencimento ON public.titulo_parcela(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcela_titulo     ON public.titulo_parcela(titulo_id);

-- ------------------------------------------------------------------------------
-- 8. TÍTULO RATEIO (por centro de custo, com plano de contas próprio opcional)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.titulo_rateio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id UUID NOT NULL REFERENCES public.titulo_parcela(id) ON DELETE CASCADE,
  centro_custo_id UUID NOT NULL REFERENCES public.centro_custo(id) ON DELETE RESTRICT,
  plano_conta_id UUID REFERENCES public.plano_conta(id) ON DELETE RESTRICT,
  percentual NUMERIC(7,4) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  valor NUMERIC(15,2) NOT NULL CHECK (valor >= 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_parcela_centro_custo UNIQUE (parcela_id, centro_custo_id)
);

CREATE INDEX IF NOT EXISTS idx_titulo_rateio_centro_custo ON public.titulo_rateio(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_titulo_rateio_plano_conta  ON public.titulo_rateio(plano_conta_id);

-- Rateio gerencial: eixo paralelo ao centro de custo, por grupo/linha de gestão.
-- É por TÍTULO (a classificação gerencial não varia entre parcelas).
-- titulo.grupo_gestao_id / linha_gestao_id guardam a linha DOMINANTE.
CREATE TABLE IF NOT EXISTS public.titulo_rateio_gestao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id UUID NOT NULL REFERENCES public.titulo(id) ON DELETE CASCADE,
  grupo_gestao_id UUID NOT NULL REFERENCES public.grupo_gestao(id) ON DELETE RESTRICT,
  linha_gestao_id UUID REFERENCES public.linha_gestao(id) ON DELETE RESTRICT,
  percentual NUMERIC(7,4) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  valor NUMERIC(15,2) NOT NULL CHECK (valor >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_titulo_gestao_linha UNIQUE (titulo_id, grupo_gestao_id, linha_gestao_id)
);

CREATE INDEX IF NOT EXISTS idx_rateio_gestao_titulo ON public.titulo_rateio_gestao(titulo_id);
CREATE INDEX IF NOT EXISTS idx_rateio_gestao_grupo  ON public.titulo_rateio_gestao(grupo_gestao_id);
CREATE INDEX IF NOT EXISTS idx_rateio_gestao_linha  ON public.titulo_rateio_gestao(linha_gestao_id);

-- ------------------------------------------------------------------------------
-- 9. MOVIMENTO (baixas efetivas e lançamentos avulsos de caixa)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.movimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id UUID REFERENCES public.titulo_parcela(id) ON DELETE RESTRICT,  -- NULL em avulso
  conta_bancaria_id UUID NOT NULL REFERENCES public.conta_bancaria(id) ON DELETE RESTRICT,
  plano_conta_id UUID REFERENCES public.plano_conta(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES public.centro_custo(id) ON DELETE SET NULL,
  tipo_movimento TEXT NOT NULL DEFAULT 'baixa_titulo' CHECK (tipo_movimento IN ('baixa_titulo', 'avulso', 'transferencia')),
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_pago NUMERIC(15,2) NOT NULL CHECK (valor_pago > 0),
  juros NUMERIC(15,2) DEFAULT 0.00 NOT NULL CHECK (juros >= 0),
  multa NUMERIC(15,2) DEFAULT 0.00 NOT NULL CHECK (multa >= 0),
  desconto NUMERIC(15,2) DEFAULT 0.00 NOT NULL CHECK (desconto >= 0),
  valor_liquido NUMERIC(15,2) NOT NULL,
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'pix', 'ted', 'boleto', 'cartao', 'cheque', 'permuta')),
  numero_documento TEXT,
  observacao TEXT,
  estornado BOOLEAN DEFAULT false NOT NULL,
  estornado_em TIMESTAMPTZ,
  estornado_por TEXT,
  motivo_estorno TEXT,
  conciliado BOOLEAN NOT NULL DEFAULT false,
  data_conciliacao TIMESTAMPTZ,
  extrato_lancamento_id UUID,             -- FK adicionada na seção 13
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_movimento_valor_liquido CHECK (valor_liquido = valor_pago + juros + multa - desconto),
  -- Movimento avulso não tem parcela, mas precisa de classificação contábil
  CONSTRAINT chk_movimento_classificacao CHECK (parcela_id IS NOT NULL OR plano_conta_id IS NOT NULL)
);

-- Impede baixar mais do que o saldo da parcela. Um CHECK não resolve: a regra
-- depende da SOMA das outras linhas. O SELECT ... FOR UPDATE trava a parcela e
-- serializa baixas simultâneas da mesma parcela.
CREATE OR REPLACE FUNCTION public.valida_saldo_movimento()
RETURNS TRIGGER AS $$
DECLARE
  v_valor_parcela NUMERIC(15,2);
  v_ja_baixado    NUMERIC(15,2);
BEGIN
  IF NEW.parcela_id IS NULL OR NEW.estornado THEN
    RETURN NEW;
  END IF;

  SELECT valor INTO v_valor_parcela
    FROM public.titulo_parcela
   WHERE id = NEW.parcela_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela % não encontrada.', NEW.parcela_id USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT COALESCE(SUM(valor_pago), 0) INTO v_ja_baixado
    FROM public.movimento
   WHERE parcela_id = NEW.parcela_id
     AND estornado = false
     AND id <> NEW.id;

  IF v_ja_baixado + NEW.valor_pago > v_valor_parcela + 0.005 THEN
    RAISE EXCEPTION
      'Baixa excede o saldo da parcela. Valor da parcela: %, já baixado: %, tentativa: %.',
      v_valor_parcela, v_ja_baixado, NEW.valor_pago
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_valida_saldo_movimento ON public.movimento;
CREATE TRIGGER trg_valida_saldo_movimento
  BEFORE INSERT OR UPDATE OF valor_pago, parcela_id, estornado ON public.movimento
  FOR EACH ROW EXECUTE FUNCTION public.valida_saldo_movimento();

CREATE INDEX IF NOT EXISTS idx_movimento_parcela        ON public.movimento(parcela_id);
CREATE INDEX IF NOT EXISTS idx_movimento_conta_bancaria ON public.movimento(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_movimento_data_pagamento ON public.movimento(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_movimento_estornado      ON public.movimento(parcela_id) WHERE estornado = false;
CREATE INDEX IF NOT EXISTS idx_movimento_conciliado     ON public.movimento(conta_bancaria_id, conciliado);

-- ------------------------------------------------------------------------------
-- 10. ORÇAMENTO
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id UUID NOT NULL REFERENCES public.centro_custo(id),
  nome TEXT NOT NULL,
  versao INT NOT NULL DEFAULT 1,
  orcamento_base_id UUID REFERENCES public.orcamento(id),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aprovado', 'revisado', 'encerrado')),
  valor_total NUMERIC(15,2) DEFAULT 0.00,
  aprovado_em TIMESTAMPTZ,
  aprovado_por TEXT,
  motivo_revisao TEXT,
  observacao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_centro_custo_versao UNIQUE (centro_custo_id, versao),
  CONSTRAINT chk_orcamento_periodo CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_orcamento_cc_status ON public.orcamento(centro_custo_id, status);

CREATE TABLE IF NOT EXISTS public.orcamento_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamento(id) ON DELETE CASCADE,
  plano_conta_id UUID NOT NULL REFERENCES public.plano_conta(id),
  centro_custo_id UUID REFERENCES public.centro_custo(id),
  codigo TEXT,
  descricao TEXT,
  quantidade NUMERIC(15,4),
  unidade TEXT,
  valor_unitario NUMERIC(15,4),
  valor_total NUMERIC(15,2) NOT NULL CHECK (valor_total >= 0),
  ordem INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_item_orcamento_id ON public.orcamento_item(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_item_centro_custo ON public.orcamento_item(centro_custo_id);

-- Vínculo da Apropriação com o Item de Orçamento
ALTER TABLE public.titulo_rateio
  ADD COLUMN IF NOT EXISTS orcamento_item_id UUID REFERENCES public.orcamento_item(id) ON DELETE RESTRICT;

ALTER TABLE public.titulo_rateio DROP CONSTRAINT IF EXISTS uq_parcela_centro_custo;

CREATE UNIQUE INDEX IF NOT EXISTS uq_parcela_centro_custo_item
  ON public.titulo_rateio (
    parcela_id,
    centro_custo_id,
    COALESCE(orcamento_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_titulo_rateio_orcamento_item ON public.titulo_rateio(orcamento_item_id);

CREATE TABLE IF NOT EXISTS public.orcamento_item_periodo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_item_id UUID NOT NULL REFERENCES public.orcamento_item(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,           -- sempre o dia 1 do mês (ex: 2026-01-01)
  valor NUMERIC(15,2) NOT NULL CHECK (valor >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_item_mes_referencia UNIQUE (orcamento_item_id, mes_referencia),
  CONSTRAINT chk_mes_referencia_dia1 CHECK (EXTRACT(DAY FROM mes_referencia) = 1)
);

CREATE INDEX IF NOT EXISTS idx_orcamento_item_periodo_item ON public.orcamento_item_periodo(orcamento_item_id);

-- ------------------------------------------------------------------------------
-- 11. FERIADOS (base do ajuste de vencimento para dia útil)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feriado (
  data DATE PRIMARY KEY,
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  ('2026-11-20', 'Consciência Negra'),
  ('2026-12-25', 'Natal'),
  ('2027-01-01', 'Confraternização Universal'),
  ('2027-02-08', 'Carnaval (Segunda)'),
  ('2027-02-09', 'Carnaval (Terça)'),
  ('2027-03-26', 'Sexta-feira Santa'),
  ('2027-04-21', 'Tiradentes'),
  ('2027-05-01', 'Dia do Trabalho'),
  ('2027-05-27', 'Corpus Christi'),
  ('2027-09-07', 'Independência do Brasil'),
  ('2027-10-12', 'Nossa Senhora Aparecida'),
  ('2027-11-02', 'Finados'),
  ('2027-11-15', 'Proclamação da República'),
  ('2027-11-20', 'Consciência Negra'),
  ('2027-12-25', 'Natal')
ON CONFLICT (data) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 12. RECORRÊNCIAS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recorrencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo CHAR(1) NOT NULL CHECK (tipo IN ('P', 'R')),
  pessoa_id UUID NOT NULL REFERENCES public.pessoa(id) ON DELETE RESTRICT,
  plano_conta_id UUID NOT NULL REFERENCES public.plano_conta(id) ON DELETE RESTRICT,
  descricao TEXT NOT NULL,
  valor_bruto NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (valor_bruto >= 0),
  tipo_valor TEXT NOT NULL DEFAULT 'fixo' CHECK (tipo_valor IN ('fixo', 'variavel')),
  frequencia TEXT NOT NULL CHECK (frequencia IN ('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  dia_vencimento INT CHECK (dia_vencimento BETWEEN 1 AND 31),
  dia_semana INT CHECK (dia_semana BETWEEN 0 AND 6),          -- 0 = Domingo
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_recorrencia_dia CHECK (
    (frequencia = 'semanal' AND dia_semana IS NOT NULL)
    OR (frequencia <> 'semanal' AND dia_vencimento IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.recorrencia_rateio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorrencia_id UUID NOT NULL REFERENCES public.recorrencia(id) ON DELETE CASCADE,
  centro_custo_id UUID NOT NULL REFERENCES public.centro_custo(id) ON DELETE RESTRICT,
  percentual NUMERIC(7,4) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_recorrencia_centro_custo UNIQUE (recorrencia_id, centro_custo_id)
);

CREATE TABLE IF NOT EXISTS public.recorrencia_ocorrencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorrencia_id UUID NOT NULL REFERENCES public.recorrencia(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,              -- sempre o dia 1º do mês de referência
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

CREATE TABLE IF NOT EXISTS public.recorrencia_log_execucao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_execucao TIMESTAMPTZ NOT NULL DEFAULT now(),
  qtd_geradas INT NOT NULL DEFAULT 0,
  qtd_puladas INT NOT NULL DEFAULT 0,
  erros_json JSONB
);

-- Vínculo e idempotência do gerador de recorrências
ALTER TABLE public.titulo DROP CONSTRAINT IF EXISTS fk_titulo_recorrencia;
ALTER TABLE public.titulo
  ADD CONSTRAINT fk_titulo_recorrencia
  FOREIGN KEY (recorrencia_id) REFERENCES public.recorrencia(id) ON DELETE SET NULL;

ALTER TABLE public.titulo DROP CONSTRAINT IF EXISTS uq_titulo_recorrencia_periodo;
ALTER TABLE public.titulo
  ADD CONSTRAINT uq_titulo_recorrencia_periodo UNIQUE (recorrencia_id, recorrencia_periodo);

CREATE INDEX IF NOT EXISTS idx_recorrencia_pessoa          ON public.recorrencia(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_recorrencia_proxima         ON public.recorrencia(proxima_competencia, status) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_recorrencia_ocorrencia_comp ON public.recorrencia_ocorrencia(recorrencia_id, competencia);
CREATE INDEX IF NOT EXISTS idx_titulo_recorrencia          ON public.titulo(recorrencia_id, recorrencia_periodo);

-- ------------------------------------------------------------------------------
-- 13. CONCILIAÇÃO BANCÁRIA
-- ------------------------------------------------------------------------------
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

CREATE TABLE IF NOT EXISTS public.conciliacao_regra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_bancaria_id UUID REFERENCES public.conta_bancaria(id) ON DELETE CASCADE,   -- NULL = todas as contas
  padrao_descricao TEXT NOT NULL,
  pessoa_id UUID REFERENCES public.pessoa(id) ON DELETE SET NULL,
  plano_conta_id UUID REFERENCES public.plano_conta(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES public.centro_custo(id) ON DELETE SET NULL,
  acao TEXT NOT NULL DEFAULT 'sugerir_lancamento' CHECK (acao IN ('sugerir_lancamento', 'ignorar')),
  vezes_aplicada INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extrato_lancamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID REFERENCES public.extrato_importacao(id) ON DELETE SET NULL,
  conta_bancaria_id UUID NOT NULL REFERENCES public.conta_bancaria(id) ON DELETE CASCADE,
  fitid TEXT NOT NULL,                    -- identificador único do OFX
  data_lancamento DATE NOT NULL,
  valor NUMERIC(15,2) NOT NULL,           -- positivo = crédito, negativo = débito
  descricao TEXT,
  documento TEXT,
  tipo_ofx TEXT,
  status TEXT NOT NULL DEFAULT 'nao_conciliado' CHECK (status IN ('nao_conciliado', 'conciliado', 'ignorado', 'divergente')),
  movimento_id UUID REFERENCES public.movimento(id) ON DELETE SET NULL,
  confianca_sugestao INT DEFAULT 0 CHECK (confianca_sugestao BETWEEN 0 AND 100),
  nivel_sugestao SMALLINT CHECK (nivel_sugestao BETWEEN 1 AND 5),
  motivo_sugestao TEXT,
  regra_aplicada_id UUID REFERENCES public.conciliacao_regra(id) ON DELETE SET NULL,
  conciliado_em TIMESTAMPTZ,
  conciliado_por TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Regra de Ouro: anti-duplicidade por FITID dentro da conta
  CONSTRAINT uq_extrato_fitid UNIQUE (conta_bancaria_id, fitid)
);

CREATE INDEX IF NOT EXISTS idx_extrato_fitid  ON public.extrato_lancamento(fitid);
CREATE INDEX IF NOT EXISTS idx_extrato_status ON public.extrato_lancamento(conta_bancaria_id, status);

-- Lado inverso do vínculo movimento ↔ extrato (criado aqui por dependência circular)
ALTER TABLE public.movimento DROP CONSTRAINT IF EXISTS fk_movimento_extrato_lancamento;
ALTER TABLE public.movimento
  ADD CONSTRAINT fk_movimento_extrato_lancamento
  FOREIGN KEY (extrato_lancamento_id) REFERENCES public.extrato_lancamento(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 14. AUTENTICAÇÃO E PERMISSÕES (domínio corporativo @deltaplanobras.com.br)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuario_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,               -- vínculo lógico com auth.users(id)
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL DEFAULT 'Colaborador',
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('administrador', 'gerente', 'operador', 'leitor')),
  is_acesso_geral BOOLEAN DEFAULT false NOT NULL,
  status_confirmacao TEXT NOT NULL DEFAULT 'ativo' CHECK (status_confirmacao IN ('ativo', 'pendente_confirmacao')),
  token_confirmacao TEXT,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_usuario_email_dominio CHECK (email LIKE '%@deltaplanobras.com.br')
);
-- Senha NUNCA fica aqui: é responsabilidade do Supabase Auth (auth.users).

CREATE TABLE IF NOT EXISTS public.usuario_departamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuario_perfil(id) ON DELETE CASCADE,
  departamento_id TEXT NOT NULL CHECK (departamento_id IN ('financeiro', 'comercial', 'rh', 'fiscal', 'juridico')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_usuario_departamento UNIQUE (usuario_id, departamento_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_perfil_email ON public.usuario_perfil(email);
CREATE INDEX IF NOT EXISTS idx_usuario_dept_user    ON public.usuario_departamento(usuario_id);

INSERT INTO public.usuario_perfil (id, email, nome, cargo, role, is_acesso_geral, ativo)
VALUES ('00000000-0000-0000-0000-000000000001',
        'renan.administrativo@deltaplanobras.com.br',
        'Renan (Administrativo)', 'Administrador Geral', 'administrador', true, true)
ON CONFLICT (email) DO UPDATE
   SET nome = EXCLUDED.nome, role = EXCLUDED.role, is_acesso_geral = true;

-- ------------------------------------------------------------------------------
-- 15. SEED DO PLANO DE CONTAS (hierarquia coerente: código de 3 partes = nível 3)
-- ------------------------------------------------------------------------------
-- Nível 1
INSERT INTO public.plano_conta (id, codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('10000000-0000-0000-0000-000000000001', '1', 'RECEITAS',                 NULL, 'receita',      1, false),
  ('20000000-0000-0000-0000-000000000002', '2', 'CUSTOS DIRETOS',           NULL, 'custo',        1, false),
  ('30000000-0000-0000-0000-000000000003', '3', 'DESPESAS ADMINISTRATIVAS', NULL, 'despesa',      1, false),
  ('40000000-0000-0000-0000-000000000004', '4', 'DESPESAS FINANCEIRAS',     NULL, 'despesa',      1, false),
  ('50000000-0000-0000-0000-000000000005', '5', 'IMPOSTOS',                 NULL, 'despesa',      1, false),
  ('60000000-0000-0000-0000-000000000006', '6', 'INVESTIMENTOS',            NULL, 'investimento', 1, false)
ON CONFLICT (codigo) DO NOTHING;

-- Nível 2 (grupos 3, 4, 5 e 6 estavam faltando e as folhas ficavam penduradas no nível 1)
INSERT INTO public.plano_conta (id, codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('11000000-0000-0000-0000-000000000011', '1.1', 'Receita operacional',       '10000000-0000-0000-0000-000000000001', 'receita',      2, false),
  ('12000000-0000-0000-0000-000000000012', '1.2', 'Receita não operacional',   '10000000-0000-0000-0000-000000000001', 'receita',      2, false),
  ('21000000-0000-0000-0000-000000000021', '2.1', 'Mão de obra',               '20000000-0000-0000-0000-000000000002', 'custo',        2, false),
  ('22000000-0000-0000-0000-000000000022', '2.2', 'Material',                  '20000000-0000-0000-0000-000000000002', 'custo',        2, false),
  ('23000000-0000-0000-0000-000000000023', '2.3', 'Equipamento',               '20000000-0000-0000-0000-000000000002', 'custo',        2, false),
  ('31000000-0000-0000-0000-000000000031', '3.1', 'Despesas administrativas',  '30000000-0000-0000-0000-000000000003', 'despesa',      2, false),
  ('41000000-0000-0000-0000-000000000041', '4.1', 'Despesas financeiras',      '40000000-0000-0000-0000-000000000004', 'despesa',      2, false),
  ('51000000-0000-0000-0000-000000000051', '5.1', 'Impostos e contribuições',  '50000000-0000-0000-0000-000000000005', 'despesa',      2, false),
  ('61000000-0000-0000-0000-000000000061', '6.1', 'Aquisição de imobilizado',  '60000000-0000-0000-0000-000000000006', 'investimento', 2, false)
ON CONFLICT (codigo) DO NOTHING;

-- Nível 3 (folhas — as únicas que aceitam lançamento)
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('1.1.01', 'Locação de equipamentos',    '11000000-0000-0000-0000-000000000011', 'receita',      3, true),
  ('1.1.02', 'Empreitada',                 '11000000-0000-0000-0000-000000000011', 'receita',      3, true),
  ('1.1.03', 'Venda de material',          '11000000-0000-0000-0000-000000000011', 'receita',      3, true),
  ('1.2.01', 'Venda de ativo',             '12000000-0000-0000-0000-000000000012', 'receita',      3, true),
  ('1.2.02', 'Rendimento de aplicação',    '12000000-0000-0000-0000-000000000012', 'receita',      3, true),
  ('2.1.01', 'Salários de obra',           '21000000-0000-0000-0000-000000000021', 'custo',        3, true),
  ('2.1.02', 'Encargos',                   '21000000-0000-0000-0000-000000000021', 'custo',        3, true),
  ('2.1.03', 'Empreiteiros terceiros',     '21000000-0000-0000-0000-000000000021', 'custo',        3, true),
  ('2.2.01', 'Material de construção',     '22000000-0000-0000-0000-000000000022', 'custo',        3, true),
  ('2.2.02', 'Material elétrico',          '22000000-0000-0000-0000-000000000022', 'custo',        3, true),
  ('2.3.01', 'Locação de terceiros',       '23000000-0000-0000-0000-000000000023', 'custo',        3, true),
  ('2.3.02', 'Manutenção de máquinas',     '23000000-0000-0000-0000-000000000023', 'custo',        3, true),
  ('2.3.03', 'Combustível',                '23000000-0000-0000-0000-000000000023', 'custo',        3, true),
  ('3.1.01', 'Salários administrativos',   '31000000-0000-0000-0000-000000000031', 'despesa',      3, true),
  ('3.1.02', 'Aluguel',                    '31000000-0000-0000-0000-000000000031', 'despesa',      3, true),
  ('3.1.03', 'Contabilidade e jurídico',   '31000000-0000-0000-0000-000000000031', 'despesa',      3, true),
  ('3.1.04', 'Software e telefonia',       '31000000-0000-0000-0000-000000000031', 'despesa',      3, true),
  ('4.1.01', 'Juros e multas pagos',       '41000000-0000-0000-0000-000000000041', 'despesa',      3, true),
  ('4.1.02', 'Tarifas bancárias',          '41000000-0000-0000-0000-000000000041', 'despesa',      3, true),
  ('4.1.03', 'IOF',                        '41000000-0000-0000-0000-000000000041', 'despesa',      3, true),
  ('5.1.01', 'Simples Nacional/DAS',       '51000000-0000-0000-0000-000000000051', 'despesa',      3, true),
  ('5.1.02', 'ISS retido',                 '51000000-0000-0000-0000-000000000051', 'despesa',      3, true),
  ('5.1.03', 'INSS retido',                '51000000-0000-0000-0000-000000000051', 'despesa',      3, true),
  ('6.1.01', 'Aquisição de máquina',       '61000000-0000-0000-0000-000000000061', 'investimento', 3, true),
  ('6.1.02', 'Aquisição de veículo',       '61000000-0000-0000-0000-000000000061', 'investimento', 3, true)
ON CONFLICT (codigo) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 16. VIEW DE PARCELAS DETALHADAS (status e saldo derivados)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_parcelas_detalhadas AS
SELECT
  tp.id                AS parcela_id,
  tp.titulo_id,
  t.codigo             AS titulo_codigo,
  t.tipo,
  t.pessoa_id,
  p.nome               AS pessoa_nome,
  p.cpf_cnpj           AS pessoa_cpf_cnpj,
  t.grupo_gestao_id,
  gg.nome              AS grupo_gestao_nome,
  t.linha_gestao_id,
  lg.nome              AS linha_gestao_nome,
  t.plano_conta_id,
  pc.codigo            AS plano_conta_codigo,
  pc.nome              AS plano_conta_nome,
  pc.natureza          AS plano_conta_natureza,
  t.numero_documento,
  t.serie,
  t.descricao          AS titulo_descricao,
  t.data_emissao,
  t.data_competencia,
  tp.numero            AS parcela_numero,
  t.qtd_parcelas,
  tp.data_vencimento,
  tp.valor             AS parcela_valor,
  COALESCE(m.total_pago, 0.00)            AS valor_baixado,
  tp.valor - COALESCE(m.total_pago, 0.00) AS saldo,
  CASE
    WHEN tp.ativo = false OR t.ativo = false THEN 'cancelado'
    WHEN (tp.valor - COALESCE(m.total_pago, 0.00)) <= 0.005 THEN 'pago'
    WHEN COALESCE(m.total_pago, 0.00) > 0 THEN 'parcial'
    WHEN tp.data_vencimento < CURRENT_DATE THEN 'vencido'
    ELSE 'aberto'
  END AS status_parcela,
  CASE
    WHEN (tp.valor - COALESCE(m.total_pago, 0.00)) > 0.005 AND tp.data_vencimento < CURRENT_DATE
    THEN (CURRENT_DATE - tp.data_vencimento)
    ELSE 0
  END AS dias_atraso,
  tp.ativo,
  t.created_by,
  t.updated_by
FROM public.titulo_parcela tp
JOIN public.titulo      t  ON t.id  = tp.titulo_id
JOIN public.pessoa      p  ON p.id  = t.pessoa_id
JOIN public.plano_conta pc ON pc.id = t.plano_conta_id
LEFT JOIN public.grupo_gestao gg ON gg.id = t.grupo_gestao_id
LEFT JOIN public.linha_gestao lg ON lg.id = t.linha_gestao_id
LEFT JOIN (
  SELECT parcela_id, SUM(valor_pago) AS total_pago
    FROM public.movimento
   WHERE estornado = false AND parcela_id IS NOT NULL
   GROUP BY parcela_id
) m ON m.parcela_id = tp.id;

-- ------------------------------------------------------------------------------
-- 17. TRIGGERS DE updated_at
-- ------------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'plano_conta','centro_custo','pessoa','conta_bancaria','grupo_gestao','linha_gestao',
    'titulo','titulo_parcela','orcamento','orcamento_item','recorrencia','usuario_perfil'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 18. ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
-- ⚠ ATENÇÃO: `USING (true)` libera leitura E escrita para a chave anônima, que
-- fica exposta no bundle do front-end. Isso só é aceitável enquanto o Passo 5
-- (Supabase Auth) não entra em produção. Ao ativar a autenticação, troque por
-- `auth.role() = 'authenticated'` no bloco abaixo.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'plano_conta','centro_custo','pessoa','conta_bancaria','grupo_gestao','linha_gestao',
    'titulo','titulo_parcela','titulo_rateio','movimento',
    'orcamento','orcamento_item','orcamento_item_periodo','feriado',
    'recorrencia','recorrencia_rateio','recorrencia_ocorrencia','recorrencia_reajuste','recorrencia_log_execucao',
    'extrato_importacao','extrato_lancamento','conciliacao_regra',
    'usuario_perfil','usuario_departamento'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_all_%s ON public.%I', t, t);
    EXECUTE format('CREATE POLICY p_all_%s ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

COMMIT;
