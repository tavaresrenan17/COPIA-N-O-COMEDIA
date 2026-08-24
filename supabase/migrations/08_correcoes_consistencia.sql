-- =============================================================================
-- ERP "MELHOR GESTÃO" — MIGRATION 08: CORREÇÃO DE INCONSISTÊNCIAS DO BANCO
-- =============================================================================
-- Esta migration foi escrita a partir da INSPEÇÃO DO BANCO REAL
-- (projeto pmsdmbmxjckjpmbrilri), e não apenas dos arquivos .sql do repositório.
--
-- Estado encontrado no banco real:
--   • Existem:  plano_conta(36), centro_custo(1), pessoa(4), grupo_gestao(12),
--               linha_gestao(47), titulo(3), titulo_parcela(4), titulo_rateio(4),
--               conta_bancaria(0), movimento(0), orcamento*(0), feriado(0),
--               extrato_importacao(0), extrato_lancamento(0), conciliacao_regra(0)
--   • NÃO existem: recorrencia*, usuario_perfil, usuario_departamento,
--                  view_parcelas_detalhadas
--
-- O script é IDEMPOTENTE: pode ser executado várias vezes sem erro.
-- Executar no Supabase → SQL Editor → New Query → colar → Run.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. CENTRO DE CUSTO "NÃO ALOCADO" ESTAVA INATIVO
-- -----------------------------------------------------------------------------
-- Problema: o único centro de custo do banco (CC-999 "Não alocado") está com
-- ativo = false, mas TODOS os 4 rateios existentes apontam para ele. Como o app
-- filtra `ativo = true` ao listar centros de custo, ele nunca aparece na tela e
-- o rateio fica "órfão" visualmente.
UPDATE public.centro_custo
   SET ativo = true,
       updated_at = now()
 WHERE id = '99999999-9999-9999-9999-999999999999'
   AND ativo = false;

-- -----------------------------------------------------------------------------
-- 2. PLANO DE CONTAS — HIERARQUIA QUEBRADA NOS GRUPOS 3, 4, 5 E 6
-- -----------------------------------------------------------------------------
-- Problema: as folhas 3.1.01 … 6.1.02 foram gravadas com `nivel = 2` e
-- `parent_id` apontando direto para o nó de nível 1, enquanto os grupos 1 e 2
-- possuem corretamente os nós intermediários (1.1, 1.2, 2.1, 2.2, 2.3).
-- Consequência: todo relatório que agrupa por "plano de contas nível 2"
-- (execução de orçamento, DRE, dashboard) some com as despesas e investimentos.
--
-- 2.1 Criar os nós de nível 2 que faltam
INSERT INTO public.plano_conta (id, codigo, nome, parent_id, natureza, nivel, aceita_lancamento) VALUES
  ('31000000-0000-0000-0000-000000000031', '3.1', 'Despesas administrativas',   '30000000-0000-0000-0000-000000000003', 'despesa',      2, false),
  ('41000000-0000-0000-0000-000000000041', '4.1', 'Despesas financeiras',       '40000000-0000-0000-0000-000000000004', 'despesa',      2, false),
  ('51000000-0000-0000-0000-000000000051', '5.1', 'Impostos e contribuições',   '50000000-0000-0000-0000-000000000005', 'despesa',      2, false),
  ('61000000-0000-0000-0000-000000000061', '6.1', 'Aquisição de imobilizado',   '60000000-0000-0000-0000-000000000006', 'investimento', 2, false)
ON CONFLICT (codigo) DO NOTHING;

-- 2.2 Repor as folhas sob o nó de nível 2 correto e corrigir o nível
UPDATE public.plano_conta SET parent_id = '31000000-0000-0000-0000-000000000031', nivel = 3, updated_at = now()
 WHERE codigo LIKE '3.1.%' AND (nivel <> 3 OR parent_id IS DISTINCT FROM '31000000-0000-0000-0000-000000000031');
UPDATE public.plano_conta SET parent_id = '41000000-0000-0000-0000-000000000041', nivel = 3, updated_at = now()
 WHERE codigo LIKE '4.1.%' AND (nivel <> 3 OR parent_id IS DISTINCT FROM '41000000-0000-0000-0000-000000000041');
UPDATE public.plano_conta SET parent_id = '51000000-0000-0000-0000-000000000051', nivel = 3, updated_at = now()
 WHERE codigo LIKE '5.1.%' AND (nivel <> 3 OR parent_id IS DISTINCT FROM '51000000-0000-0000-0000-000000000051');
UPDATE public.plano_conta SET parent_id = '61000000-0000-0000-0000-000000000061', nivel = 3, updated_at = now()
 WHERE codigo LIKE '6.1.%' AND (nivel <> 3 OR parent_id IS DISTINCT FROM '61000000-0000-0000-0000-000000000061');

-- 2.3 Regra estrutural: nó que tem filho NUNCA aceita lançamento
UPDATE public.plano_conta pai
   SET aceita_lancamento = false, updated_at = now()
 WHERE pai.aceita_lancamento = true
   AND EXISTS (SELECT 1 FROM public.plano_conta f WHERE f.parent_id = pai.id);

-- -----------------------------------------------------------------------------
-- 3. TÍTULO — CÓDIGO SEQUENCIAL VIA SEQUENCE (E NÃO VIA COUNT(*) NO APP)
-- -----------------------------------------------------------------------------
-- Problema: o app gerava `codigo` como COUNT(*) + 1. Com exclusão física de
-- qualquer título, ou com dois cadastros simultâneos, o valor colide com a
-- constraint UNIQUE e a gravação falha.
CREATE SEQUENCE IF NOT EXISTS public.titulo_codigo_seq AS BIGINT MINVALUE 1;

SELECT setval(
  'public.titulo_codigo_seq',
  COALESCE((SELECT MAX(codigo::BIGINT) FROM public.titulo WHERE codigo ~ '^[0-9]+$'), 0) + 1,
  false
);

ALTER TABLE public.titulo
  ALTER COLUMN codigo SET DEFAULT lpad(nextval('public.titulo_codigo_seq')::TEXT, 6, '0');

-- -----------------------------------------------------------------------------
-- 4. TÍTULO — COLUNAS DE RECORRÊNCIA QUE O APP ESPERA E O BANCO NÃO TEM
-- -----------------------------------------------------------------------------
-- `Titulo.recorrenciaId` e `Titulo.recorrenciaPeriodo` existem em src/data/types.ts
-- e na migration 05, mas nunca chegaram ao banco.
ALTER TABLE public.titulo
  ADD COLUMN IF NOT EXISTS recorrencia_id UUID,
  ADD COLUMN IF NOT EXISTS recorrencia_periodo TEXT;

-- -----------------------------------------------------------------------------
-- 5. TÍTULO / PARCELA — CHECK DE VALOR CONFLITA COM "AGUARDANDO VALOR"
-- -----------------------------------------------------------------------------
-- Problema: `valor_bruto > 0` impede gravar um título de recorrência de valor
-- variável (aguardando_valor = true), que nasce sem valor definido.
ALTER TABLE public.titulo DROP CONSTRAINT IF EXISTS titulo_valor_bruto_check;
ALTER TABLE public.titulo DROP CONSTRAINT IF EXISTS chk_titulo_valor_bruto;
ALTER TABLE public.titulo
  ADD CONSTRAINT chk_titulo_valor_bruto
  CHECK (valor_bruto > 0 OR aguardando_valor = true);

ALTER TABLE public.titulo_parcela DROP CONSTRAINT IF EXISTS titulo_parcela_valor_check;
ALTER TABLE public.titulo_parcela DROP CONSTRAINT IF EXISTS chk_titulo_parcela_valor;
ALTER TABLE public.titulo_parcela
  ADD CONSTRAINT chk_titulo_parcela_valor CHECK (valor >= 0);

-- -----------------------------------------------------------------------------
-- 6. TÍTULO — COERÊNCIA ENTRE TIPO (P/R) E NATUREZA DO PLANO DE CONTAS
-- -----------------------------------------------------------------------------
-- Problema real encontrado: os 3 títulos existentes são do tipo 'P' (a pagar)
-- mas estão classificados em "1.1.01 Locação de equipamentos", cuja natureza é
-- RECEITA. Isso inverte o sinal de qualquer DRE / dashboard / orçamento.
-- A causa está no app (fallback que pegava o primeiro plano de contas de
-- qualquer natureza) e foi corrigida em src/data/supabase/supabase.repository.ts.
-- Aqui garantimos a regra no banco, para que o erro não volte por outro caminho.
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

-- ATENÇÃO — CORREÇÃO DOS DADOS JÁ GRAVADOS (decisão de negócio, revise antes):
-- Os 3 títulos abaixo continuam classificados em conta de receita. Descomente
-- e ajuste o plano de contas de destino conforme a realidade de cada um:
--
-- UPDATE public.titulo SET plano_conta_id = (SELECT id FROM public.plano_conta WHERE codigo = '2.3.02')
--  WHERE codigo IN ('000001','000002');   -- Manutenção de máquinas (correia/bateria)
-- UPDATE public.titulo SET plano_conta_id = (SELECT id FROM public.plano_conta WHERE codigo = '3.1.04')
--  WHERE codigo = '000003';               -- "TESTE"

-- -----------------------------------------------------------------------------
-- 7. TITULO_RATEIO — PLANO DE CONTAS POR LINHA DE RATEIO
-- -----------------------------------------------------------------------------
-- Problema: a tela de cadastro de título permite escolher um plano de contas
-- por linha de rateio (`r.planoContaId`), mas a coluna não existia — o dado era
-- descartado silenciosamente na gravação.
ALTER TABLE public.titulo_rateio
  ADD COLUMN IF NOT EXISTS plano_conta_id UUID REFERENCES public.plano_conta(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- Backfill: quem não tem plano próprio herda o plano de contas do título
UPDATE public.titulo_rateio r
   SET plano_conta_id = t.plano_conta_id
  FROM public.titulo_parcela p
  JOIN public.titulo t ON t.id = p.titulo_id
 WHERE r.parcela_id = p.id
   AND r.plano_conta_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_titulo_rateio_centro_custo ON public.titulo_rateio(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_titulo_rateio_plano_conta  ON public.titulo_rateio(plano_conta_id);

-- -----------------------------------------------------------------------------
-- 7.1 RATEIO GERENCIAL (GRUPO / LINHA DE GESTÃO) POR PERCENTUAL
-- -----------------------------------------------------------------------------
-- O título carregava UM grupo e UMA linha de gestão (colunas grupo_gestao_id e
-- linha_gestao_id), o que impede repartir o valor entre várias linhas.
-- Esta tabela é o eixo gerencial do rateio, paralelo ao rateio por centro de
-- custo: ambos somam 100% do título, cada um sobre uma dimensão de análise.
--
-- É por TÍTULO, não por parcela: a classificação gerencial não muda de uma
-- parcela para outra — diferente do centro de custo, que pode.
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

-- Backfill: o que já existe vira uma linha de 100%
INSERT INTO public.titulo_rateio_gestao (titulo_id, grupo_gestao_id, linha_gestao_id, percentual, valor)
SELECT t.id, t.grupo_gestao_id, t.linha_gestao_id, 100.0000, t.valor_bruto
  FROM public.titulo t
 WHERE t.grupo_gestao_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.titulo_rateio_gestao g WHERE g.titulo_id = t.id)
ON CONFLICT DO NOTHING;

-- titulo.grupo_gestao_id / linha_gestao_id continuam existindo como a linha
-- DOMINANTE (maior percentual), para os relatórios que leem um valor só.

-- -----------------------------------------------------------------------------
-- 8. PESSOA — CATEGORIA DO FORNECEDOR
-- -----------------------------------------------------------------------------
-- `Pessoa.categoriaFornecedor` é exibida e pesquisável na tela de Fornecedores,
-- mas não tinha coluna: o valor se perdia a cada salvamento.
ALTER TABLE public.pessoa
  ADD COLUMN IF NOT EXISTS categoria_fornecedor TEXT;

CREATE INDEX IF NOT EXISTS idx_pessoa_flags ON public.pessoa(is_cliente, is_fornecedor) WHERE ativo = true;

-- -----------------------------------------------------------------------------
-- 9. MOVIMENTO — VÍNCULO COM O EXTRATO BANCÁRIO
-- -----------------------------------------------------------------------------
-- `extrato_lancamento.movimento_id` existe, mas o lado inverso
-- (`movimento.extrato_lancamento_id`, previsto na migration 07 e no tipo
-- `Movimento` do app) nunca foi criado no banco.
ALTER TABLE public.movimento
  ADD COLUMN IF NOT EXISTS extrato_lancamento_id UUID REFERENCES public.extrato_lancamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_conciliacao TIMESTAMPTZ;

-- Índices duplicados criados pelas migrations 03 e schema_completo (nomes diferentes,
-- mesma coluna). Mantemos apenas a nomenclatura idx_<tabela>_<coluna>.
DROP INDEX IF EXISTS public.idx_movimento_conta;
DROP INDEX IF EXISTS public.idx_movimento_data;
CREATE INDEX IF NOT EXISTS idx_movimento_conta_bancaria  ON public.movimento(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_movimento_data_pagamento  ON public.movimento(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_movimento_estornado       ON public.movimento(parcela_id) WHERE estornado = false;

-- Coerência aritmética da baixa: liquido = pago + juros + multa - desconto
ALTER TABLE public.movimento DROP CONSTRAINT IF EXISTS chk_movimento_valor_liquido;
ALTER TABLE public.movimento
  ADD CONSTRAINT chk_movimento_valor_liquido
  CHECK (valor_liquido = valor_pago + juros + multa - desconto);

-- Movimento avulso não tem parcela, mas precisa de classificação contábil
ALTER TABLE public.movimento DROP CONSTRAINT IF EXISTS chk_movimento_classificacao;
ALTER TABLE public.movimento
  ADD CONSTRAINT chk_movimento_classificacao
  CHECK (parcela_id IS NOT NULL OR plano_conta_id IS NOT NULL);

-- Impede baixar mais do que o saldo da parcela.
-- Um CHECK não resolve: a regra depende da SOMA das outras linhas de movimento.
-- O SELECT ... FOR UPDATE trava a parcela e serializa baixas simultâneas — é o
-- que fecha a corrida de duas abas (ou duplo clique) baixando a mesma parcela.
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

-- -----------------------------------------------------------------------------
-- 10. EXTRATO_LANCAMENTO — CAMPOS DO MOTOR DE CASAMENTO
-- -----------------------------------------------------------------------------
-- `nivelSugestao`, `motivoSugestao` e `regraAplicadaId` existem no tipo
-- ExtratoLancamento do app e não tinham coluna.
ALTER TABLE public.extrato_lancamento
  ADD COLUMN IF NOT EXISTS nivel_sugestao    SMALLINT CHECK (nivel_sugestao BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS motivo_sugestao   TEXT,
  ADD COLUMN IF NOT EXISTS regra_aplicada_id UUID REFERENCES public.conciliacao_regra(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 11. LINHA DE GESTÃO — CÓDIGO ÚNICO POR GRUPO (E NÃO GLOBAL)
-- -----------------------------------------------------------------------------
-- Problema: `codigo TEXT UNIQUE` é global. Com 12 grupos de gestão, o grupo 002
-- não consegue ter uma linha "001" porque o grupo 001 já usou esse código —
-- por isso as 47 linhas atuais foram numeradas 001…047 em sequência corrida.
-- Remove qualquer UNIQUE que esteja apenas em (codigo), seja qual for o nome gerado
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public' AND rel.relname = 'linha_gestao'
       AND con.contype = 'u'
       AND con.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                                WHERE attrelid = rel.oid AND attname = 'codigo')]::SMALLINT[]
  LOOP
    EXECUTE format('ALTER TABLE public.linha_gestao DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.linha_gestao DROP CONSTRAINT IF EXISTS uq_linha_gestao_grupo_codigo;
ALTER TABLE public.linha_gestao
  ADD CONSTRAINT uq_linha_gestao_grupo_codigo UNIQUE (grupo_gestao_id, codigo);

CREATE INDEX IF NOT EXISTS idx_linha_gestao_grupo ON public.linha_gestao(grupo_gestao_id);

-- -----------------------------------------------------------------------------
-- 12. RECORRÊNCIAS (ETAPA 8) — TABELAS QUE NUNCA FORAM CRIADAS
-- -----------------------------------------------------------------------------
-- As migrations 05 e 06 declaram a MESMA tabela `recorrencia` com formatos
-- diferentes e ambas usam CREATE TABLE IF NOT EXISTS: rodando 05 antes de 06,
-- o banco ficaria com o formato antigo (05) silenciosamente, sem as colunas que
-- o app usa. A versão canônica é a da migration 06, com dois ajustes de nome
-- para casar com src/data/types.ts:
--     valor            -> valor_bruto        (Recorrencia.valorBrutoCentavos)
--     proxima_geracao  -> proxima_competencia (Recorrencia.proximaCompetencia)
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
    dia_semana INT CHECK (dia_semana BETWEEN 0 AND 6),
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
    -- Frequência semanal exige dia da semana; as demais exigem dia do mês
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
    -- Espelha uq_parcela_centro_custo de titulo_rateio (faltava na migration 06)
    CONSTRAINT uq_recorrencia_centro_custo UNIQUE (recorrencia_id, centro_custo_id)
);

CREATE TABLE IF NOT EXISTS public.recorrencia_ocorrencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recorrencia_id UUID NOT NULL REFERENCES public.recorrencia(id) ON DELETE CASCADE,
    competencia DATE NOT NULL,
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

-- Agora que `recorrencia` existe, fecha a FK e a idempotência do gerador
ALTER TABLE public.titulo DROP CONSTRAINT IF EXISTS fk_titulo_recorrencia;
ALTER TABLE public.titulo
  ADD CONSTRAINT fk_titulo_recorrencia
  FOREIGN KEY (recorrencia_id) REFERENCES public.recorrencia(id) ON DELETE SET NULL;

ALTER TABLE public.titulo DROP CONSTRAINT IF EXISTS uq_titulo_recorrencia_periodo;
ALTER TABLE public.titulo
  ADD CONSTRAINT uq_titulo_recorrencia_periodo UNIQUE (recorrencia_id, recorrencia_periodo);

CREATE INDEX IF NOT EXISTS idx_recorrencia_pessoa           ON public.recorrencia(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_recorrencia_proxima          ON public.recorrencia(proxima_competencia, status) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_recorrencia_ocorrencia_comp  ON public.recorrencia_ocorrencia(recorrencia_id, competencia);
CREATE INDEX IF NOT EXISTS idx_titulo_recorrencia           ON public.titulo(recorrencia_id, recorrencia_periodo);
CREATE INDEX IF NOT EXISTS idx_titulo_aguardando_valor      ON public.titulo(aguardando_valor) WHERE aguardando_valor = true;

-- -----------------------------------------------------------------------------
-- 13. AUTENTICAÇÃO (PASSO 5) — TABELAS AUSENTES NO BANCO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuario_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,              -- FK lógica para auth.users(id) do Supabase
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL DEFAULT 'Colaborador',
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('administrador', 'gerente', 'operador', 'leitor')),
  is_acesso_geral BOOLEAN DEFAULT false NOT NULL,
  -- Campos que existem em UsuarioPerfil (types.ts) e não tinham coluna
  status_confirmacao TEXT NOT NULL DEFAULT 'ativo' CHECK (status_confirmacao IN ('ativo', 'pendente_confirmacao')),
  token_confirmacao TEXT,
  ativo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_usuario_email_dominio CHECK (email LIKE '%@deltaplanobras.com.br')
);
-- Observação: `senhaTemporaria` do tipo UsuarioPerfil NÃO vira coluna de propósito.
-- Senha é responsabilidade do Supabase Auth (auth.users), nunca da tabela de perfil.

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
   SET nome = EXCLUDED.nome, role = EXCLUDED.role, is_acesso_geral = true, updated_at = now();

-- -----------------------------------------------------------------------------
-- 14. updated_at — TRIGGER ÚNICO PARA TODAS AS TABELAS
-- -----------------------------------------------------------------------------
-- Problema: `updated_at` tinha DEFAULT now() mas nunca era atualizado, exceto
-- quando o app mandava o valor na mão (só em pessoa e titulo). O restante ficava
-- eternamente igual ao created_at.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'plano_conta','centro_custo','pessoa','conta_bancaria','grupo_gestao','linha_gestao',
    'titulo','titulo_parcela','orcamento','orcamento_item','recorrencia','usuario_perfil'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name=t AND column_name='updated_at') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
    END IF;
  END LOOP;
END $$;

-- A migration 05 criou uma função de trigger exclusiva para recorrencia; agora é redundante
DROP TRIGGER IF EXISTS trg_set_updated_at_recorrencia ON public.recorrencia;
DROP FUNCTION IF EXISTS public.set_updated_at_recorrencia();

-- -----------------------------------------------------------------------------
-- 15. FERIADOS — TABELA EXISTE MAS ESTÁ VAZIA
-- -----------------------------------------------------------------------------
-- O ajuste de vencimento para dia útil (antecipa/posterga) depende desta tabela.
-- Faltava também o 20/11 (Consciência Negra), feriado nacional desde 2024.
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

-- -----------------------------------------------------------------------------
-- 16. VIEW DE PARCELAS DETALHADAS
-- -----------------------------------------------------------------------------
-- As migrations 02 e 03 criam esta view, mas ela não existe no banco. Recriada
-- aqui já alinhada às colunas que o título ganhou depois (codigo, gestão).
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
  COALESCE(m.total_pago, 0.00)              AS valor_baixado,
  tp.valor - COALESCE(m.total_pago, 0.00)   AS saldo,
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

-- -----------------------------------------------------------------------------
-- 17. RLS — PADRONIZAÇÃO EM TODAS AS TABELAS
-- -----------------------------------------------------------------------------
-- Problema: metade das tabelas tinha RLS ligado com política permissiva e a
-- outra metade (orcamento*, feriado, extrato_*, conciliacao_regra) estava sem
-- RLS nenhum. Além disso, os CREATE POLICY do schema_completo não tinham
-- DROP antes, então reexecutar o script quebrava com "policy already exists".
--
-- ATENÇÃO DE SEGURANÇA: a política abaixo é `USING (true)` — libera leitura e
-- escrita para a chave anônima, que está exposta no bundle do front-end.
-- Isso é aceitável só enquanto o Passo 5 (autenticação) não entra. Ao ativar o
-- Supabase Auth, troque `true` por `auth.role() = 'authenticated'` (bloco
-- comentado no final desta seção).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'plano_conta','centro_custo','pessoa','conta_bancaria','grupo_gestao','linha_gestao',
    'titulo','titulo_parcela','titulo_rateio','titulo_rateio_gestao','movimento',
    'orcamento','orcamento_item','orcamento_item_periodo','feriado',
    'recorrencia','recorrencia_rateio','recorrencia_ocorrencia','recorrencia_reajuste','recorrencia_log_execucao',
    'extrato_importacao','extrato_lancamento','conciliacao_regra',
    'usuario_perfil','usuario_departamento'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- Remove as políticas antigas de nomes variados criadas pelos scripts anteriores
      EXECUTE format('DROP POLICY IF EXISTS "Acesso total publico %s" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "Permitir tudo em %s para autenticados" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS p_all_%s ON public.%I', t, t);
      EXECUTE format('CREATE POLICY p_all_%s ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END IF;
  END LOOP;
END $$;

-- Versão endurecida, para ativar junto com o Passo 5 (Supabase Auth):
--   CREATE POLICY p_all_<tabela> ON public.<tabela> FOR ALL
--     USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMIT;

-- =============================================================================
-- CONFERÊNCIA PÓS-EXECUÇÃO (rode separadamente e confira o resultado)
-- =============================================================================
-- Deve retornar 0 linhas: folha do plano de contas com nível incoerente com o código
-- SELECT codigo, nivel FROM public.plano_conta
--  WHERE nivel <> (length(codigo) - length(replace(codigo,'.','')) + 1);
--
-- Deve retornar 0 linhas: título a pagar em conta de receita (e vice-versa)
-- SELECT t.codigo, t.tipo, pc.codigo, pc.natureza
--   FROM public.titulo t JOIN public.plano_conta pc ON pc.id = t.plano_conta_id
--  WHERE (t.tipo='R' AND pc.natureza<>'receita') OR (t.tipo='P' AND pc.natureza='receita');
--
-- Deve retornar 0 linhas: soma das parcelas diferente do valor do título
-- SELECT t.codigo, t.valor_bruto, SUM(p.valor)
--   FROM public.titulo t JOIN public.titulo_parcela p ON p.titulo_id = t.id
--  WHERE p.ativo GROUP BY t.id, t.codigo, t.valor_bruto HAVING SUM(p.valor) <> t.valor_bruto;
--
-- Deve retornar 0 linhas: rateio de parcela que não fecha 100%
-- SELECT parcela_id, SUM(percentual) FROM public.titulo_rateio
--  GROUP BY parcela_id HAVING ROUND(SUM(percentual),4) <> 100.0000;
