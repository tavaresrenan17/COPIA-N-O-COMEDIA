-- =============================================================================
-- MIGRATION 10: O CENTRO DE CUSTO PASSA A APONTAR PARA A LINHA DE GESTÃO
-- =============================================================================
-- O vínculo existia do lado errado. `linha_gestao.centro_custo_id` é 1:1, então
-- vincular um segundo centro de custo à mesma linha ROUBAVA o vínculo do
-- primeiro — a tela de centro de custos tinha até um passo explícito de
-- "desvincular a linha anterior" só por causa disso.
--
-- Invertendo, uma linha de gestão passa a reunir várias obras, que é o que a
-- Apropriação precisa para oferecer as obras da linha escolhida no título.
--
-- Seguro e idempotente: só adiciona coluna e copia o que já existe. Nenhum dado
-- é alterado ou removido, e `linha_gestao.centro_custo_id` continua de pé —
-- aposentada no código, derrubada só numa migration futura, depois que este
-- deploy provar que ninguém mais depende dela.
-- =============================================================================

BEGIN;

ALTER TABLE public.centro_custo
  ADD COLUMN IF NOT EXISTS linha_gestao_id UUID REFERENCES public.linha_gestao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_centro_custo_linha_gestao
  ON public.centro_custo(linha_gestao_id);

-- Backfill: cada linha que aponta para um centro de custo passa a ser apontada
-- por ele. `IS NULL` para não sobrescrever vínculo já gravado do lado novo, o
-- que torna a migration repetível sem efeito colateral.
UPDATE public.centro_custo cc
   SET linha_gestao_id = lg.id
  FROM public.linha_gestao lg
 WHERE lg.centro_custo_id = cc.id
   AND cc.linha_gestao_id IS NULL;

COMMIT;

-- Conferência (não altera nada):
--   SELECT cc.codigo, cc.nome, lg.codigo, lg.nome
--     FROM public.centro_custo cc
--     JOIN public.linha_gestao lg ON lg.id = cc.linha_gestao_id
--    ORDER BY cc.codigo;
