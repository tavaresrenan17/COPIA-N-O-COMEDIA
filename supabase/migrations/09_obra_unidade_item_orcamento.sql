-- =============================================================================
-- ERP "MELHOR GESTÃO" — MIGRATION 09: OBRA, UNIDADE CONSTRUTIVA E ITEM DE ORÇAMENTO
-- =============================================================================
-- Suporta a reformulação da aba APROPRIAÇÃO do cadastro de títulos, que deixa de
-- classificar por (Centro de Custo → Linha de Centro de Custo → Plano Financeiro)
-- e passa a classificar por (Obra → Unidade Construtiva → Item de Orçamento).
--
-- NÃO cria tabela nova para Obra/Unidade: a árvore `centro_custo` já é exatamente
-- essa hierarquia — a tela dela sempre se chamou "Centro de Custos (Obras &
-- Projetos)". O nó raiz passa a ser lido como OBRA e o nó filho como UNIDADE
-- CONSTRUTIVA. Sem tabela nova, `titulo_rateio.centro_custo_id` continua válido e
-- BI, dashboard e fluxo de caixa seguem funcionando sem reescrita.
--
-- O que muda de fato no banco:
--   1. linha_gestao ganha a OBRA vinculada (é o elo pedido: a linha de gestão
--      escolhida na Alocação de Títulos determina quais obras a Apropriação lista);
--   2. orcamento_item ganha CÓDIGO (a planilha orçamentária é exibida por código);
--   3. titulo_rateio ganha o ITEM DE ORÇAMENTO apropriado;
--   4. a UNIQUE (parcela_id, centro_custo_id) é substituída — ver seção 4.
--
-- Independe da migration 08: nada aqui toca as colunas que ela cria.
-- O script é IDEMPOTENTE: pode ser executado várias vezes sem erro.
-- Executar no Supabase → SQL Editor → New Query → colar → Run.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. LINHA DE GESTÃO — OBRA VINCULADA
-- -----------------------------------------------------------------------------
-- Cada Linha de Gestão passa a apontar para a Obra (nó raiz de centro_custo) a
-- que pertence. É esse vínculo que faz a aba Apropriação saber quais obras
-- oferecer: só as obras das linhas de gestão alocadas na aba anterior.
--
-- Nullable de propósito: as 47 linhas de gestão já cadastradas não têm obra, e
-- exigi-la agora deixaria o cadastro existente inválido. Linha sem obra
-- simplesmente não contribui com obras para a Apropriação.
ALTER TABLE public.linha_gestao
  ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES public.centro_custo(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.linha_gestao.centro_custo_id IS
  'Obra vinculada (nó raiz de centro_custo). Alimenta o filtro de obras da aba Apropriação.';

CREATE INDEX IF NOT EXISTS idx_linha_gestao_centro_custo ON public.linha_gestao(centro_custo_id);

-- -----------------------------------------------------------------------------
-- 2. ITEM DE ORÇAMENTO — CÓDIGO
-- -----------------------------------------------------------------------------
-- A planilha orçamentária é lida por código ("1.1.3 Alvenaria"), não por UUID.
-- Sem essa coluna o combo de Item de Orçamento só teria a descrição livre.
ALTER TABLE public.orcamento_item
  ADD COLUMN IF NOT EXISTS codigo TEXT;

COMMENT ON COLUMN public.orcamento_item.codigo IS
  'Código do item na planilha orçamentária (ex.: "1.1.3"). Exibido no combo da Apropriação.';

-- orcamento_item.centro_custo_id já existia como "sub-centro opcional" e passa a
-- ser a UNIDADE CONSTRUTIVA do item. Não muda de tipo nem de referência.
COMMENT ON COLUMN public.orcamento_item.centro_custo_id IS
  'Unidade Construtiva do item (nó filho da obra em centro_custo).';

COMMENT ON COLUMN public.orcamento.centro_custo_id IS
  'Obra do orçamento (nó raiz de centro_custo).';

CREATE INDEX IF NOT EXISTS idx_orcamento_item_centro_custo ON public.orcamento_item(centro_custo_id);

-- -----------------------------------------------------------------------------
-- 3. TITULO_RATEIO — ITEM DE ORÇAMENTO APROPRIADO
-- -----------------------------------------------------------------------------
-- A terceira coluna da Apropriação deixa de ser o Plano Financeiro e passa a ser
-- o Item de Orçamento. `plano_conta_id` CONTINUA sendo gravado (derivado do item,
-- via orcamento_item.plano_conta_id): a tela mostra o item, e DRE, dashboard e BI
-- seguem agrupando por plano de contas como sempre fizeram.
--
-- ON DELETE RESTRICT: apagar um item de orçamento já apropriado em título
-- desmontaria a classificação de um lançamento financeiro.
ALTER TABLE public.titulo_rateio
  ADD COLUMN IF NOT EXISTS orcamento_item_id UUID REFERENCES public.orcamento_item(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.titulo_rateio.orcamento_item_id IS
  'Item de orçamento apropriado. plano_conta_id continua preenchido, derivado deste item.';

CREATE INDEX IF NOT EXISTS idx_titulo_rateio_orcamento_item ON public.titulo_rateio(orcamento_item_id);

-- -----------------------------------------------------------------------------
-- 4. UNIQUE DO RATEIO — PRECISA INCLUIR O ITEM DE ORÇAMENTO
-- -----------------------------------------------------------------------------
-- ESTA É A PARTE QUE QUEBRA O SALVAMENTO SE FOR ESQUECIDA.
--
-- `uq_parcela_centro_custo UNIQUE (parcela_id, centro_custo_id)` (migration 02)
-- permite UMA linha de rateio por centro de custo em cada parcela. Isso fazia
-- sentido no modelo antigo. No novo, apropriar a mesma Unidade Construtiva em
-- dois itens de orçamento diferentes é o caso NORMAL:
--
--     Obra Alfa / Torre 1 / 1.1.3 Alvenaria .... 60%
--     Obra Alfa / Torre 1 / 1.2.1 Concreto ..... 40%
--
-- Nos dois, centro_custo_id é a Torre 1 → a segunda linha viola a UNIQUE e o
-- título inteiro falha ao salvar.
--
-- Trocamos por um índice único que inclui o item. O COALESCE é deliberado: em
-- Postgres NULL <> NULL, então (parcela, cc, NULL) duas vezes passaria batido —
-- exatamente o furo que a constraint antiga fechava. Com o UUID zerado no lugar
-- do NULL, rateio sem item volta a ser um por centro de custo, como antes.
-- (`NULLS NOT DISTINCT` faria o mesmo, mas só em PG 15+.)
ALTER TABLE public.titulo_rateio DROP CONSTRAINT IF EXISTS uq_parcela_centro_custo;

CREATE UNIQUE INDEX IF NOT EXISTS uq_parcela_centro_custo_item
  ON public.titulo_rateio (
    parcela_id,
    centro_custo_id,
    COALESCE(orcamento_item_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

COMMIT;

-- =============================================================================
-- CONFERÊNCIA PÓS-EXECUÇÃO (rode separadamente e confira o resultado)
-- =============================================================================
-- Deve retornar as 3 colunas novas:
-- SELECT table_name, column_name FROM information_schema.columns
--  WHERE (table_name, column_name) IN
--        (('linha_gestao','centro_custo_id'),('orcamento_item','codigo'),
--         ('titulo_rateio','orcamento_item_id'));
--
-- Deve retornar 'uq_parcela_centro_custo_item' e NÃO 'uq_parcela_centro_custo':
-- SELECT indexname FROM pg_indexes
--  WHERE tablename = 'titulo_rateio' AND indexname LIKE 'uq_parcela%';
--
-- Deve retornar 0 linhas: item de orçamento cuja unidade construtiva não é filha
-- da obra do próprio orçamento
-- SELECT i.id, i.codigo FROM public.orcamento_item i
--   JOIN public.orcamento o ON o.id = i.orcamento_id
--   JOIN public.centro_custo u ON u.id = i.centro_custo_id
--  WHERE i.centro_custo_id IS NOT NULL
--    AND u.parent_id IS DISTINCT FROM o.centro_custo_id
--    AND u.id <> o.centro_custo_id;
