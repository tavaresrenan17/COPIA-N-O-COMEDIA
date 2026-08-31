-- =============================================================================
-- MIGRATION 11: CENTRO DE CUSTO COMO GRUPO MACRO — GLOBAL OU DE LINHAS ESCOLHIDAS
-- =============================================================================
-- O centro de custo passa a ser o GRUPO MACRO que reúne obras, e o alcance dele
-- tem duas formas:
--   - GLOBAL: as obras dele aparecem junto com as de qualquer linha alocada;
--   - POR LINHA: aparecem só quando uma das linhas escolhidas está alocada.
--
-- Substitui a `centro_custo.linha_gestao_id` da migration 10, que só comportava
-- UMA linha. Esta migration é auto-suficiente: funciona com a 10 já aplicada ou
-- sem ela, porque procura o vínculo antigo nos dois lugares onde ele pode estar.
--
-- Seguro e idempotente: cria tabela e coluna se não existirem, e o backfill
-- ignora o que já foi gravado. Nada é alterado ou removido.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ALCANCE GLOBAL
-- -----------------------------------------------------------------------------
ALTER TABLE public.centro_custo
  ADD COLUMN IF NOT EXISTS escopo_global BOOLEAN NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- 2. VÍNCULO N:N COM AS LINHAS DE GESTÃO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.centro_custo_linha_gestao (
  centro_custo_id UUID NOT NULL REFERENCES public.centro_custo(id) ON DELETE CASCADE,
  linha_gestao_id UUID NOT NULL REFERENCES public.linha_gestao(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (centro_custo_id, linha_gestao_id)
);

CREATE INDEX IF NOT EXISTS idx_ccl_centro_custo ON public.centro_custo_linha_gestao(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_ccl_linha_gestao ON public.centro_custo_linha_gestao(linha_gestao_id);

ALTER TABLE public.centro_custo_linha_gestao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo em centro_custo_linha_gestao" ON public.centro_custo_linha_gestao;
CREATE POLICY "Permitir tudo em centro_custo_linha_gestao"
  ON public.centro_custo_linha_gestao FOR ALL USING (true);

-- -----------------------------------------------------------------------------
-- 3. BACKFILL — de onde quer que o vínculo antigo esteja
-- -----------------------------------------------------------------------------
-- (a) da migration 10, se ela chegou a rodar. O bloco é condicional porque a
--     coluna pode não existir, e aí o SQL nem compilaria referenciando-a direto.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'centro_custo'
       AND column_name = 'linha_gestao_id'
  ) THEN
    EXECUTE '
      INSERT INTO public.centro_custo_linha_gestao (centro_custo_id, linha_gestao_id)
      SELECT cc.id, cc.linha_gestao_id
        FROM public.centro_custo cc
       WHERE cc.linha_gestao_id IS NOT NULL
      ON CONFLICT DO NOTHING';
  END IF;
END $$;

-- (b) do vínculo original, em `linha_gestao.centro_custo_id`. Cobre o caso de a
--     migration 10 nunca ter sido aplicada.
INSERT INTO public.centro_custo_linha_gestao (centro_custo_id, linha_gestao_id)
SELECT lg.centro_custo_id, lg.id
  FROM public.linha_gestao lg
 WHERE lg.centro_custo_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;

-- Conferência (não altera nada):
--   SELECT cc.codigo, cc.nome, cc.escopo_global, lg.codigo, lg.nome
--     FROM public.centro_custo cc
--     LEFT JOIN public.centro_custo_linha_gestao ccl ON ccl.centro_custo_id = cc.id
--     LEFT JOIN public.linha_gestao lg ON lg.id = ccl.linha_gestao_id
--    ORDER BY cc.codigo;
