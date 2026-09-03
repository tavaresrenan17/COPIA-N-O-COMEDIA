-- ---------------------------------------------------------------------------
-- 13. CENTRO DE CUSTO: TIPOS QUE FALTAVAM NA CONSTRAINT
-- ---------------------------------------------------------------------------
--
-- A migration 01 criou centro_custo.tipo com CHECK de quatro valores:
--   ('obra', 'administrativo', 'frota', 'comercial')
--
-- Depois disso o app passou a usar mais dois — 'centro_custo' e
-- 'centro_custo_obra' — e o schema_completo.sql foi atualizado para os seis.
-- Só que schema_completo.sql usa CREATE TABLE IF NOT EXISTS: num banco que já
-- existia, a tabela é pulada inteira e a constraint antiga permanece. Nenhuma
-- migration chegou a alterá-la, então o banco ficou parado nos quatro valores.
--
-- O resultado na tela: cadastrar "Apenas Centro de Custo" (tipo
-- 'centro_custo') ou "Centro de Custo & Obra" ('centro_custo_obra') falhava
-- com "new row for relation centro_custo violates check constraint
-- centro_custo_tipo_check". E 'centro_custo_obra' é o tipo que já vem marcado
-- ao abrir o cadastro, então o caminho padrão era justamente um dos quebrados.
--
-- Aqui a constraint passa a valer os seis valores de TipoCentroCusto
-- (src/data/types.ts), que é o que o schema_completo.sql já declarava.
-- ---------------------------------------------------------------------------

BEGIN;

ALTER TABLE public.centro_custo
  DROP CONSTRAINT IF EXISTS centro_custo_tipo_check;

ALTER TABLE public.centro_custo
  ADD CONSTRAINT centro_custo_tipo_check
  CHECK (tipo IN ('centro_custo', 'obra', 'centro_custo_obra', 'administrativo', 'frota', 'comercial'));

COMMIT;

-- Conferência: deve devolver os seis valores.
--   SELECT pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conname = 'centro_custo_tipo_check';
