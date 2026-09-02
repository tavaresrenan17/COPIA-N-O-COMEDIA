-- ---------------------------------------------------------------------------
-- 12. SUBSTITUIÇÃO COMPLETA DO PLANO FINANCEIRO
-- ---------------------------------------------------------------------------
--
-- Troca o plano de contas inteiro pelo plano definido pelo cliente.
--
-- ATENÇÃO — esta migration APAGA DADOS. Ela remove todos os títulos, parcelas,
-- rateios e itens de orçamento existentes, porque eles referenciam as contas
-- antigas por FK ON DELETE RESTRICT e não haveria como manter o vínculo depois
-- da troca. Decisão tomada explicitamente: os registros eram de teste.
--
-- Antes de rodar em qualquer banco com dado real, EXPORTE:
--   plano_conta, titulo, titulo_parcela, titulo_rateio, titulo_rateio_gestao,
--   orcamento, orcamento_item
--
-- Estrutura do plano novo: 139 contas, 3 níveis.
--   nível 1  →  2 grupos raiz  (1 ENTRADAS/RECEITAS, 2 SAÍDAS/CUSTOS/DESPESAS)
--   nível 2  →  16 grupos
--   nível 3  →  121 folhas, que são as que aceitam lançamento
--
-- Natureza: tudo em "1." é receita; tudo em "2." é despesa. Custo e
-- investimento não são usados — a separação pedida foi por grupo raiz.
--
-- O bloco 2.09 do material de origem ficou de fora de propósito: os nomes
-- ("1", "ESSE", "COLOCAR AQUI", "REDUTORA") eram rascunho. O código 2.09
-- segue livre para cadastro pela tela.
-- ---------------------------------------------------------------------------

BEGIN;

-- 1. Dados que dependem do plano antigo -------------------------------------
--    titulo_parcela, titulo_rateio e titulo_rateio_gestao caem por CASCATA
--    junto com titulo; orcamento_item_periodo cai junto com orcamento_item.
DELETE FROM public.titulo;
DELETE FROM public.orcamento_item;

--    O orçamento em si permanece, agora vazio — o total precisa acompanhar.
UPDATE public.orcamento SET valor_total = 0;

-- 2. O plano antigo ----------------------------------------------------------
DELETE FROM public.plano_conta;

-- 3. O plano novo ------------------------------------------------------------
--    Inserido em ordem de código: o pai sempre existe antes do filho, e o
--    parent_id é resolvido pelo código do pai.

INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1', 'ENTRADAS/RECEITAS', NULL, 'receita', 1, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.01', 'RECEITA OPERACIONAL', (SELECT id FROM public.plano_conta WHERE codigo = '1'), 'receita', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.01.01', 'Receita de Serviços', (SELECT id FROM public.plano_conta WHERE codigo = '1.01'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.01.02', 'Sinal do contrato com cliente', (SELECT id FROM public.plano_conta WHERE codigo = '1.01'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.01.03', 'Entrada do contrato', (SELECT id FROM public.plano_conta WHERE codigo = '1.01'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.01.04', '(-)ISS s/ Serviços', (SELECT id FROM public.plano_conta WHERE codigo = '1.01'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.01.05', '(-)INSS s/ Serviços', (SELECT id FROM public.plano_conta WHERE codigo = '1.01'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.02', 'EMPRÉSTIMOS E FINANCIAMENTOS', (SELECT id FROM public.plano_conta WHERE codigo = '1'), 'receita', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.02.01', 'Aporte de Sócio', (SELECT id FROM public.plano_conta WHERE codigo = '1.02'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.02.02', 'Empréstimo terceiros', (SELECT id FROM public.plano_conta WHERE codigo = '1.02'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.03', 'VENDAS E LOCAÇÕES', (SELECT id FROM public.plano_conta WHERE codigo = '1'), 'receita', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.03.01', 'Locação de Equipamentos/Máquinas', (SELECT id FROM public.plano_conta WHERE codigo = '1.03'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.03.02', 'Venda de materiais de obra', (SELECT id FROM public.plano_conta WHERE codigo = '1.03'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.03.03', 'Venda de ferramentas', (SELECT id FROM public.plano_conta WHERE codigo = '1.03'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.04', 'ENTRADA INTERNA', (SELECT id FROM public.plano_conta WHERE codigo = '1'), 'receita', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.04.01', 'Recebimento interno', (SELECT id FROM public.plano_conta WHERE codigo = '1.04'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.05', 'DESCONTOS', (SELECT id FROM public.plano_conta WHERE codigo = '1'), 'receita', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('1.05.01', '(-)Descontar do Funcionário', (SELECT id FROM public.plano_conta WHERE codigo = '1.05'), 'receita', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2', 'SAÍDAS / CUSTOS / DESPESAS', NULL, 'despesa', 1, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01', 'MÃO DE OBRA E ENCARGOS', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.01', 'Salários e ordenados', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.02', 'Diárias combinadas', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.03', 'Serviços Terceirizados e Empreiteiros', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.04', 'Férias', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.05', '13º Salário', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.06', 'Bonificações', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.07', 'Salário Família', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.10', 'Alimentação', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.11', 'Transporte', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.12', 'Custeio de Treinamento', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.13', 'Assistência médica', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.14', 'Custo de Rescisão', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.15', 'Seguro de vida', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.16', 'Uniformes e EPI''s', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.17', 'Medicina Ocupacional', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.18', 'Horas extras', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.19', 'Adiantamento e Vales Diaristas', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.20', 'Pagamento Empresas', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.21', 'Salários CLT', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.22', 'Salários PJ', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.23', 'Salários Estagiários', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.24', 'Adiantamento e Vales PJ', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.25', 'Adiantamento e Vales CLT', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.01.26', 'Seguro de vida dos funcionários', (SELECT id FROM public.plano_conta WHERE codigo = '2.01'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.02', 'AUTUAÇÕES E INFRAÇÕES', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.02.01', 'Multas e Correções por Atraso de no pagamento', (SELECT id FROM public.plano_conta WHERE codigo = '2.02'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.02.02', 'Autuações Fiscais', (SELECT id FROM public.plano_conta WHERE codigo = '2.02'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.02.03', 'Infrações de Trânsito', (SELECT id FROM public.plano_conta WHERE codigo = '2.02'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.02.04', 'Infrações Ambientais (Ruído, Limpeza, Licenças)', (SELECT id FROM public.plano_conta WHERE codigo = '2.02'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03', 'CONTAS DE OBRAS', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.01', 'Materiais de Obra', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.02', 'Aquisição de ferramentas', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.03', 'Aluguéis de imóveis', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.04', 'Condomínio', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.05', 'Água e esgoto', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.06', 'Energia Elétrica', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.07', 'Gás', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.08', 'Aquisição de móveis e utensílios', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.09', 'Material de Escritório', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.10', 'Material de Limpeza', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.11', 'Locação de ferramentas', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.12', 'Abastecimento', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.13', 'Sinalização de obra', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.14', 'Despesas com Cartórios e Legalizações', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.15', 'Fretes e Entrega', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.16', 'Equipamentos Eletrônicos', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.17', 'Provedores de Internet', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.18', 'Licenças de Softwares', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.19', 'Manutenção de Veículos', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.20', 'Aquisição de Equipamentos', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.21', 'Aquisição de Veículos', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.22', 'Seguro de Veículos', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.23', 'Pedágio/Estacionamento', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.24', 'Locação de Veículo', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.25', 'Passagens', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.26', 'Hospedagem', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.27', 'Custo de vida Engenheiro(a)', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.28', 'Projetos', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.29', 'Telefone', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.30', 'Eventos da empresa', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.31', 'Locação de Máquinas', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.32', 'Reembolso de KM', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.33', 'Licença Médica', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.34', 'Manutenção Geral', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.35', 'Reembolso Geral', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.36', 'Equipamentos', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.37', 'Caixinha', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.03.38', 'Despesas Veiculos', (SELECT id FROM public.plano_conta WHERE codigo = '2.03'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.04', 'SERVIÇOS ESPECIALIZADOS', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.04.01', 'Assessoria Jurídica', (SELECT id FROM public.plano_conta WHERE codigo = '2.04'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.04.02', 'Assessoria Contábil', (SELECT id FROM public.plano_conta WHERE codigo = '2.04'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.04.03', 'Assessoria R.H', (SELECT id FROM public.plano_conta WHERE codigo = '2.04'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.04.04', 'Consultoria em T.I', (SELECT id FROM public.plano_conta WHERE codigo = '2.04'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.04.05', 'Assessoria de Qualidade', (SELECT id FROM public.plano_conta WHERE codigo = '2.04'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.04.06', 'Assessoria de Marketing', (SELECT id FROM public.plano_conta WHERE codigo = '2.04'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.04.07', 'Assessoria de Dados', (SELECT id FROM public.plano_conta WHERE codigo = '2.04'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.04.08', 'Assessoria de Segurança', (SELECT id FROM public.plano_conta WHERE codigo = '2.04'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.05', 'DESPESAS DOS SÓCIOS', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.05.01', 'Retirada de Sócios', (SELECT id FROM public.plano_conta WHERE codigo = '2.05'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.05.02', 'Contas Pessoais', (SELECT id FROM public.plano_conta WHERE codigo = '2.05'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.05.03', 'Devolução de aporte', (SELECT id FROM public.plano_conta WHERE codigo = '2.05'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.05.04', 'Investimentos em conjunto', (SELECT id FROM public.plano_conta WHERE codigo = '2.05'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.06', 'DESPESAS FINANCEIRAS', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.06.01', 'Tarifas Diversas', (SELECT id FROM public.plano_conta WHERE codigo = '2.06'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.06.02', 'Taxa de Aquisição de Crédito', (SELECT id FROM public.plano_conta WHERE codigo = '2.06'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.06.03', 'Juros sobre Empréstimos', (SELECT id FROM public.plano_conta WHERE codigo = '2.06'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.06.04', 'Multas e Acréscimos', (SELECT id FROM public.plano_conta WHERE codigo = '2.06'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.06.05', 'IPTU', (SELECT id FROM public.plano_conta WHERE codigo = '2.06'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.06.06', 'Quitação empréstimo', (SELECT id FROM public.plano_conta WHERE codigo = '2.06'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.07', 'CONTENCIOSO', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.07.01', 'Ações Trabalhistas', (SELECT id FROM public.plano_conta WHERE codigo = '2.07'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.07.02', 'Ações Civis Diversas', (SELECT id FROM public.plano_conta WHERE codigo = '2.07'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.08', 'DÍVIDAS RECONHECIDAS', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.08.01', 'Dívida com Funcionário', (SELECT id FROM public.plano_conta WHERE codigo = '2.08'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.08.02', 'Dívida com Governo', (SELECT id FROM public.plano_conta WHERE codigo = '2.08'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.08.03', 'Dívida com Banco', (SELECT id FROM public.plano_conta WHERE codigo = '2.08'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.08.04', 'Dívida com Fornecedor', (SELECT id FROM public.plano_conta WHERE codigo = '2.08'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.10', 'DESPESAS TRIBUTÁRIAS', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.10.01', 'GUIA PIS', (SELECT id FROM public.plano_conta WHERE codigo = '2.10'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.10.02', 'GUIA COFINS', (SELECT id FROM public.plano_conta WHERE codigo = '2.10'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.10.03', 'GUIA ISS', (SELECT id FROM public.plano_conta WHERE codigo = '2.10'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.10.04', 'GUIA IRPJ', (SELECT id FROM public.plano_conta WHERE codigo = '2.10'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.10.05', 'GUIA CSLL', (SELECT id FROM public.plano_conta WHERE codigo = '2.10'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.10.06', 'GUIA DAS (SIMPLES)', (SELECT id FROM public.plano_conta WHERE codigo = '2.10'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.10.07', 'GUIA MEI', (SELECT id FROM public.plano_conta WHERE codigo = '2.10'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11', 'TRIBUTOS E ENCARGOS DA FOLHA DE PAGAMENTO', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.01', 'INSS Funcionários', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.02', 'INSS Patronal (Desoneração)', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.03', 'FGTS', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.04', 'FGTS Rescisório', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.05', 'IRRF Terceiros PF (0588)', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.06', 'IRRF Terceiros PJ (1708)', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.07', 'Contribuição Sindical Confederativa', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.08', 'Contribuição Sindical Patronal', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.09', 'Entidades/Conselhos de Classe (CREA, CRA)', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.10', 'Cofre Leis Sociais', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.11.11', 'Guia DARF', (SELECT id FROM public.plano_conta WHERE codigo = '2.11'), 'despesa', 3, true, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.12', 'SAÍDA INTERNA', (SELECT id FROM public.plano_conta WHERE codigo = '2'), 'despesa', 2, false, true);
INSERT INTO public.plano_conta (codigo, nome, parent_id, natureza, nivel, aceita_lancamento, ativo)
VALUES ('2.12.01', 'Saída interna', (SELECT id FROM public.plano_conta WHERE codigo = '2.12'), 'despesa', 3, true, true);

COMMIT;

-- Conferência pós-execução:
--   SELECT nivel, COUNT(*) FROM public.plano_conta GROUP BY nivel ORDER BY nivel;
--     esperado: 1→2, 2→16, 3→121
--   SELECT COUNT(*) FROM public.plano_conta WHERE parent_id IS NULL;
--     esperado: 2
--   SELECT COUNT(*) FROM public.plano_conta WHERE aceita_lancamento;
--     esperado: 121
