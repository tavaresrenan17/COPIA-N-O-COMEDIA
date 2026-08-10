# Dicionário de Dados — ERP "Melhor Gestão"

Mapeamento entre as variáveis TypeScript (`src/data/types.ts`) e as colunas do
banco (`schema_completo.sql`). Regra geral de nomenclatura:

| Camada | Convenção | Exemplo |
|---|---|---|
| TypeScript | `camelCase` | `dataVencimento` |
| PostgreSQL | `snake_case` | `data_vencimento` |
| Chave estrangeira | `<entidade>Id` → `<entidade>_id` | `planoContaId` → `plano_conta_id` |
| Booleano | `is<Coisa>` / `<adjetivo>` | `isCliente` → `is_cliente`, `ativo` |

**Unidades — a regra que mais causa erro:** o app trabalha com **centavos
(inteiro)** e o banco com **reais (`NUMERIC(15,2)`)**. Todo campo TS com sufixo
`Centavos` vira uma coluna **sem** o sufixo, e a conversão (`/100` na escrita,
`Math.round(x * 100)` na leitura) acontece **só** em
`src/data/supabase/supabase.repository.ts`. Nenhum componente de UI deve fazer
essa conversão.

---

## 1. `pessoa` — Clientes e Fornecedores

| Variável (TS) | Coluna | Tipo | Observação |
|---|---|---|---|
| `id` | `id` | UUID | |
| `cpfCnpj` | `cpf_cnpj` | TEXT | UNIQUE. Gravado **com máscara** (`502.053.368-84`) |
| `tipoPessoa` | `tipo_pessoa` | CHAR | `'F'` \| `'J'` |
| `nome` | `nome` | TEXT | |
| `nomeFantasia` | `nome_fantasia` | TEXT | |
| `inscricaoEstadual` | `inscricao_estadual` | TEXT | |
| `dataNascimento` | `data_nascimento` | DATE | |
| `email`, `telefone`, `cep` | idem | TEXT | |
| `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf` | idem | TEXT | |
| `isCliente` | `is_cliente` | BOOL | Ao menos um dos dois precisa ser `true` |
| `isFornecedor` | `is_fornecedor` | BOOL | |
| `categoriaFornecedor` | `categoria_fornecedor` | TEXT | **Coluna criada agora** — antes o valor se perdia ao salvar |
| `banco`, `agencia`, `conta` | idem | TEXT | Dados bancários **da pessoa** (≠ tabela `conta_bancaria`) |
| `chavePix` | `chave_pix` | TEXT | |
| `planoContaPadraoId` | `plano_conta_padrao_id` | UUID | FK → `plano_conta` |
| `condicaoPagamentoPadrao` | `condicao_pagamento_padrao` | INT | **em dias**, não em parcelas |
| `observacao` | `observacao` | TEXT | |
| `ativo` | `ativo` | BOOL | Exclusão é lógica |

---

## 2. `plano_conta`

| Variável (TS) | Coluna | Tipo | Observação |
|---|---|---|---|
| `codigo` | `codigo` | TEXT | UNIQUE. **Nº de partes do código = `nivel`** (`3.1.01` → nível 3) |
| `parentId` | `parent_id` | UUID | Auto-referência |
| `natureza` | `natureza` | TEXT | `receita` \| `custo` \| `despesa` \| `investimento` |
| `nivel` | `nivel` | INT | 1 = grupo, 2 = subgrupo, 3 = folha |
| `aceitaLancamento` | `aceita_lancamento` | BOOL | **Só folha aceita.** Nó com filho é sempre `false` |
| `filhos` | — | — | Montado em memória a partir de `parent_id` |

---

## 3. `centro_custo`

| Variável (TS) | Coluna | Observação |
|---|---|---|
| `codigo`, `nome`, `parentId`, `nivel`, `ativo` | idem snake_case | |
| `tipo` | `tipo` | `obra` \| `administrativo` \| `frota` \| `comercial` |
| `aceitaLancamento` | `aceita_lancamento` | |
| `dataInicio` / `dataFim` | `data_inicio` / `data_fim` | Vigência do centro de custo |
| `orcamentoCentavos`, `gastoCentavos` | — | **Derivados**, calculados de `orcamento` e `movimento` |
| `subempresaId`, `subempresaNome` | — | **Descontinuados** (ver §11) |

> `CC-999 "Não alocado"` (id `99999999-…-999999999999`) é o destino padrão de
> rateio. Precisa permanecer `ativo = true`, senão some das telas.

---

## 4. `titulo`

| Variável (TS) | Coluna | Tipo | Observação |
|---|---|---|---|
| `codigo` | `codigo` | TEXT | **Gerado pelo banco** (`titulo_codigo_seq`, 6 dígitos). O app não envia mais |
| `tipo` | `tipo` | CHAR(1) | `'P'` = pagar, `'R'` = receber |
| `pessoaId` | `pessoa_id` | UUID | |
| `grupoGestaoId` | `grupo_gestao_id` | UUID | |
| `linhaGestaoId` | `linha_gestao_id` | UUID | |
| `planoContaId` | `plano_conta_id` | UUID | **`'R'` exige natureza `receita`; `'P'` proíbe** (trigger `trg_valida_natureza_titulo`) |
| `numeroDocumento` | `numero_documento` | TEXT | |
| `serie` | `serie` | TEXT | Hoje carrega também o *tipo de documento* — merece coluna própria |
| `dataEmissao` | `data_emissao` | DATE | |
| `dataCompetencia` | `data_competencia` | DATE | Regime de competência (relatórios) |
| `valorBrutoCentavos` | `valor_bruto` | NUMERIC | **centavos → reais** |
| `qtdParcelas` | `qtd_parcelas` | INT | |
| `aguardandoValor` | `aguardando_valor` | BOOL | Recorrência de valor variável; libera `valor_bruto = 0` |
| `recorrenciaId` | `recorrencia_id` | UUID | |
| `recorrenciaPeriodo` | `recorrencia_periodo` | TEXT | UNIQUE com `recorrencia_id` (idempotência) |
| `createdBy` / `updatedBy` | `created_by` / `updated_by` | TEXT | Nome livre do operador — ver §12 |
| `parcelas` | — | — | Relação com `titulo_parcela` |
| `logsAudit` | — | — | **Sem tabela.** A auditoria não é persistida (ver §12) |
| `subempresaId`, `grupoLinhaCustoId`, `linhaCustoId` | — | — | **Descontinuados** (ver §11) |

---

## 5. `titulo_parcela` e `titulo_rateio`

| Variável (TS) | Coluna | Observação |
|---|---|---|
| `TituloParcela.tituloId` | `titulo_id` | |
| `TituloParcela.numero` | `numero` | UNIQUE com `titulo_id` |
| `TituloParcela.dataVencimento` | `data_vencimento` | |
| `TituloParcela.valorCentavos` | `valor` | centavos → reais |
| `TituloRateio.centroCustoId` | `centro_custo_id` | UNIQUE com `parcela_id` |
| `TituloRateio.planoContaId` | `plano_conta_id` | **Coluna criada agora** — o plano escolhido por linha de rateio era descartado |
| `TituloRateio.percentual` | `percentual` | `NUMERIC(7,4)`, 0–100. A soma por parcela deve fechar 100 |
| `TituloRateio.valorCentavos` | `valor` | centavos → reais |

> O rateio pendura na **parcela**, não no título: parcelas diferentes do mesmo
> título podem ter rateios diferentes.

---

## 6. `movimento` — baixas e lançamentos de caixa

| Variável (TS) | Coluna | Observação |
|---|---|---|
| `parcelaId` | `parcela_id` | **NULL** em lançamento avulso |
| `tipoMovimento` | `tipo_movimento` | `baixa_titulo` \| `avulso` \| `transferencia` |
| `planoContaId` / `centroCustoId` | `plano_conta_id` / `centro_custo_id` | Obrigatórios quando `parcela_id` é NULL |
| `contaBancariaId` | `conta_bancaria_id` | |
| `dataPagamento` | `data_pagamento` | Regime de caixa |
| `valorPagoCentavos` | `valor_pago` | centavos → reais |
| `jurosCentavos` / `multaCentavos` / `descontoCentavos` | `juros` / `multa` / `desconto` | |
| `valorLiquidoCentavos` | `valor_liquido` | **`= pago + juros + multa − desconto`** (garantido por CHECK) |
| `formaPagamento` | `forma_pagamento` | `dinheiro`\|`pix`\|`ted`\|`boleto`\|`cartao`\|`cheque`\|`permuta` |
| `estornado` | `estornado` | Estorno **nunca** apaga a linha; só marca |
| `estornadoEm`/`estornadoPor`/`motivoEstorno` | `estornado_em`/`estornado_por`/`motivo_estorno` | |
| `conciliado` | `conciliado` | |
| `dataConciliacao` | `data_conciliacao` | **Coluna criada agora** |
| `extratoLancamentoId` | `extrato_lancamento_id` | **Coluna criada agora** |
| `fitid` | — | **Não tem coluna e não deve ter.** O FITID pertence a `extrato_lancamento.fitid`; leia via `extrato_lancamento_id` |

---

## 7. `recorrencia`

Duas migrations (05 e 06) definiam esta tabela com formatos diferentes. Nomes
canônicos, escolhidos para casar com o TypeScript:

| Variável (TS) | Coluna correta | Nome errado que circulava |
|---|---|---|
| `valorBrutoCentavos` | `valor_bruto` | `valor` (migration 06) |
| `proximaCompetencia` | `proxima_competencia` | `proxima_geracao` (migration 05) |
| `ultimaCompetenciaGerada` | `ultima_competencia_gerada` | — |
| `tipoValor` | `tipo_valor` | `fixo` \| `variavel` |
| `diaVencimento` / `diaSemana` | `dia_vencimento` / `dia_semana` | Semanal usa `dia_semana` (0 = domingo); as demais, `dia_vencimento` |
| `ajusteDiaUtil` | `ajuste_dia_util` | `nenhum` \| `antecipa` \| `posterga` |
| `antecedenciaGeracao` | `antecedencia_geracao` | em dias |
| `gerarAutomatico` | `gerar_automatico` | |
| `indiceReajuste` / `mesReajuste` / `percentualReajuste` | `indice_reajuste` / `mes_reajuste` / `percentual_reajuste` | |
| `rateios` | tabela `recorrencia_rateio` | |

---

## 8. `extrato_lancamento` — conciliação

| Variável (TS) | Coluna | Observação |
|---|---|---|
| `fitid` | `fitid` | UNIQUE com `conta_bancaria_id` — anti-duplicidade |
| `dataLancamento` | `data_lancamento` | |
| `valorCentavos` | `valor` | **Positivo = crédito, negativo = débito** (único lugar do sistema onde o valor pode ser negativo) |
| `confiancaSugestao` | `confianca_sugestao` | 0–100 |
| `nivelSugestao` | `nivel_sugestao` | **Coluna criada agora** — 1 a 5 |
| `motivoSugestao` | `motivo_sugestao` | **Coluna criada agora** |
| `regraAplicadaId` | `regra_aplicada_id` | **Coluna criada agora** |
| `movimentosAgrupadosIds` | — | **Sem coluna.** Casamento N:1 (borderô) precisa de tabela de ligação `extrato_movimento` |

---

## 9. `usuario_perfil`

| Variável (TS) | Coluna | Observação |
|---|---|---|
| `email` | `email` | UNIQUE + CHECK de domínio `@deltaplanobras.com.br` |
| `role` | `role` | `administrador`\|`gerente`\|`operador`\|`leitor` |
| `isAcessoGeral` | `is_acesso_geral` | |
| `statusConfirmacao` | `status_confirmacao` | **Coluna criada agora** |
| `tokenConfirmacao` | `token_confirmacao` | **Coluna criada agora** |
| `departamentosPermitidos` | tabela `usuario_departamento` | 1:N |
| `senhaTemporaria` | — | **Não vira coluna, de propósito.** Senha é do Supabase Auth (`auth.users`) |
| — | `auth_user_id` | Vínculo com `auth.users(id)`, para o Passo 5 |

---

## 10. `orcamento` — aliases retrocompatíveis

| Alias no TS | Nome correto |
|---|---|
| `Orcamento.descricao` | `observacao` |
| `Orcamento.dataAprovacao` | `aprovadoEm` → `aprovado_em` |
| `Orcamento.isVigente` | derivado: `status = 'aprovado'` e maior `versao` |
| `OrcamentoItem.planoContaNivel2Id/Codigo/Nome` | `planoContaId` → `plano_conta_id` |
| `OrcamentoItem.distribuicaoMensal` | `periodos` → tabela `orcamento_item_periodo` |
| `OrcamentoEmpreendimento` (tipo) | alias de `Orcamento` |
| `StatusOrcamentoEmpreendimento` (tipo) | alias de `StatusOrcamentoStatus` |

---

## 11. Variáveis sem coluna — descontinuadas

`Subempresa`, `GrupoLinhaCusto` e `LinhaCusto` foram substituídos por
`GrupoGestao` / `LinhaGestao`. O repositório Supabase já devolve `[]` ou lança
"Descontinuado" nesses métodos. Os campos abaixo continuam nos tipos apenas por
retrocompatibilidade e **não têm coluna**:

`Titulo.subempresaId`, `Titulo.grupoLinhaCustoId`, `Titulo.linhaCustoId`,
`CentroCusto.subempresaId`, `ParcelaView.subempresaNome`,
`ParcelaView.grupoLinhaCustoNome`, `ParcelaView.linhaCustoNome`.

Equivalência: **Subempresa → Grupo de Gestão**, **Linha de Custo → Linha de Gestão**.

---

## 12. Pendências conhecidas

1. **`created_by` / `updated_by` são TEXT livre.** No banco convivem
   `"Fabrício (Administrador)"` e `"Renan (Administrativo) (Administrador Geral)"`
   para o mesmo papel. Ao entrar o Passo 5, trocar por
   `created_by_id UUID REFERENCES usuario_perfil(id)`.
2. **`TituloAuditLog` não é persistido.** `Titulo.logsAudit` só existe em memória
   (mock). Precisa de tabela `titulo_auditoria`.
3. **Anexos de título** ficam concatenados em `observacao` — precisa de tabela
   `titulo_anexo` + Supabase Storage.
4. **`serie` acumula dois significados** (série do documento e tipo do documento).
5. **`ParcelaView.centrosCustoFormatado`** está fixo em `"Não alocado"` no
   repositório Supabase; deve ser montado a partir de `titulo_rateio`.
