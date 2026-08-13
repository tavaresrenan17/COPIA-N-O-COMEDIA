# ERP "Melhor Gestão" — Documentação do Projeto & Roteiro de Desenvolvimento

---

## 📌 1. O que é o ERP "Melhor Gestão"

O **Melhor Gestão** é um ERP web completo, moderno e responsivo para gestão empresarial. O sistema reúne os principais pilares operacionais de uma empresa em uma interface única de altíssimo padrão visual e alta usabilidade:
- **Fluxo Financeiro**: Contas a Pagar e Contas a Receber com baixa de registros.
- **Rastreamento Orçamentário**: Centro de Custos integrado com cálculo de consumo em tempo real.
- **Operação Comercial**: Orçamentos / DAV (Documento Auxiliar de Venda) com **Timeline Stepper** animado (`Faturado` → `Expedido` → `Entregue` → `Recebido`).
- **Base de Cadastros**: Clientes (CPF/CNPJ), Fornecedores por categoria de insumos e Centro de Custos.
- **Painel Analítico**: Dashboard executivo com métricas financeiras e gráficos em **Recharts**.

---

## 🛠️ 2. Stack Tecnológica & Arquitetura

- **Framework**: Next.js 15 (App Router com TypeScript e `src/` directory).
- **Estilização**: Tailwind CSS + CSS Variables em HSL (Formato ESM com `postcss.config.mjs`).
- **Animações**: Motion (Framer Motion).
- **Gráficos**: Recharts.
- **Ícones**: Lucide React.
- **Formatações**: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` para valores armazenados em centavos (inteiros), máscaras de CPF/CNPJ e datas em `DD/MM/AAAA`.

### 🏗️ Padrão de Arquitetura (Repository Pattern)
Toda leitura e escrita de dados do aplicativo é isolada na camada de repositório:
- `src/data/types.ts`: Modelos de dados TypeScript.
- `src/data/repository.interface.ts`: Interface contrato `IErpRepository`.
- `src/data/mock/mock.repository.ts`: Implementação em memória (`MockErpRepository`) usada nos Passos 1–3.
- `src/data/index.ts`: Ponto único de exportação singleton (`export const erpRepository: IErpRepository`).

> **Importante**: No **Passo 4 (Supabase)**, basta criar `SupabaseErpRepository` implementando `IErpRepository` e alterar a exportação em `src/data/index.ts`. Nenhum componente de UI precisará ser alterado!

---

## 🎨 3. Design System & Tokens Visuais

Extraídos e aprovados a partir da captura de tela de inspiração ("gestão + fácil"):
- **Sidebar Escura (Shell)**: `hsl(246, 28%, 12%)` (`#171526`).
- **Primária / Brand Accent**: `hsl(252, 85%, 63%)` (`#7C4DFF`) / Hover `hsl(252, 85%, 55%)`.
- **Canvas / Fundo**: `hsl(230, 25%, 97%)` (`#F4F5FA`).
- **Superfícies / Cards**: `hsl(0, 0%, 100%)` (`#FFFFFF`).
- **Tipografia**: `Plus Jakarta Sans` / System Sans-serif.
- **Bordas Arredondadas**: `20px` nos containers principais, `14px` nos cards e `10px` nos botões/inputs.

---

## 🚦 4. Roteiro dos 7 Passos & Status Atual

| # | Passo | Entregável | Status |
|---|---|---|---|
| 1 | **Design de Inspiração** | Design system extraído em tokens HSL | ✅ Validado |
| 2 | **UI + Animações** | Telas dos módulos, sidebar agrupada e Stepper animado | ✅ Concluído |
| 3 | **Teste Local** | App rodando 100% no localhost com dados mock em memória | ✅ Concluído (localhost:3000) |
| 4 | **Banco de Dados** | Supabase: tabelas, RLS e persistência real em banco | ⏳ Próximo |
| 5 | **Autenticação** | Supabase Auth com `@supabase/ssr`, login e proteção de rotas | 🔒 Bloqueado |
| 6 | **Deploy** | VPS Hostinger (PM2 + Nginx + HTTPS) | 🔒 Bloqueado |
| 7 | **Testes Finais** | Validação ponta a ponta e entrega final | 🔒 Bloqueado |

---

## 📂 5. Estrutura dos Módulos Desenvolvidos

```
src/
├── app/
│   ├── page.tsx (Dashboard de Análises & Indicadores com Recharts)
│   ├── orcamentos/page.tsx (Orçamentos DAV com Stepper animado)
│   ├── contas-pagar/page.tsx (Contas a Pagar com código auto CP-00X, forma de pagto, centro de custos, fornecedores)
│   ├── contas-receber/page.tsx (Contas a Receber com baixas e vínculo ao centro de custos)
│   ├── clientes/page.tsx (Cadastro de Clientes com CPF/CNPJ)
│   ├── fornecedores/page.tsx (Cadastro de Fornecedores por categoria)
│   ├── centro-custos/page.tsx (Centro de Custos com código auto CC-00X e barras de consumo)
│   ├── layout.tsx (Shell principal com Sidebar e Topbar)
│   └── globals.css (CSS base e variáveis HSL)
├── components/
│   ├── Sidebar.tsx (Navegação lateral retrátil agrupada em FINANCEIRO e CADASTRO)
│   ├── Topbar.tsx (Cabeçalho com usuário Fabrício e notificações)
│   ├── DarkNavHeader.tsx (Barra escura horizontal de atalhos rápidos)
│   ├── SubNavCard.tsx (Painel lateral interno Movimentação)
│   └── StatusStepper.tsx (Linha do tempo animada com Framer Motion)
├── data/
│   ├── types.ts (Tipagem dos modelos de domínio)
│   ├── repository.interface.ts (Contrato de CRUD)
│   ├── mock/mock.repository.ts (Dados em memória)
│   └── index.ts (Exportação singleton erpRepository)
└── lib/
    └── formatters.ts (Formatação de moeda BRL em centavos, datas e CPF/CNPJ)
```

---

## 🤖 6. Instruções para Futuros Modelos de IA / Desenvolvedores

Caso outro modelo de IA ou desenvolvedor continue o desenvolvimento deste repositório, siga **rigorosamente** estas diretrizes:

1. **Idioma & Respostas**: Todas as respostas para o usuário devem ser entregues em **Português do Brasil (pt-BR)**.
2. **Link Clicável Obligatório**: Sempre que modificar ou testar o aplicativo, forneça um link clicável markdown (ex: `http://localhost:3000` ou `http://localhost:3000/contas-pagar`).
3. **Respeite o Roteiro dos 7 Passos**: Não pule passos. O próximo passo é o **Passo 4 (Integração Supabase)**.
4. **Camada de Repositório Intacta**: NUNCA faça chamadas diretas de banco de dados dentro das páginas ou componentes de UI (`src/app/` ou `src/components/`). Toda comunicação com dados deve passar exclusivamente através do `erpRepository` em `src/data/index.ts`.
5. **Valores Monetários**: Todos os valores monetários devem continuar sendo manipulados em **centavos (inteiro)** no backend/repositório e formatados na UI usando `formatCurrency` de `src/lib/formatters.ts`.
6. **Evite Build Concorrente com Dev Server**: Ao testar alterações no dev server (`npm run dev`), caso precise rodar `npm run build`, interrompa o servidor dev antes ou limpe a pasta `.next` para evitar corrupção do cache do Webpack/React Server Components.
7. **Testes Visuais**: Não execute ferramentas de screenshot/browser agent a menos que o usuário solicite explicitamente, para priorizar a velocidade de resposta.
8. **Edição e Exclusão em Cadastros**: Todo e qualquer tipo de cadastro que for criado ou modificado no sistema DEVE possuir obrigatoriamente as opções e funcionalidades de **Editar** e **Excluir** os registros.
10. **Independência do Cadastro Inicial (Primeira Aba)**: A primeira aba dos formulários de cadastro (aba Cadastro Inicial / Dados Gerais) DEVE SEMPRE permitir que o usuário salve o registro completo sem nunca forçá-lo ou levá-lo automaticamente a navegar para outras abas (Parcelas, Alocação, Apropriação). O preenchimento/detalhamento das demais abas (Apropriação por Centro de Custo, Alocação por Gestão e Parcelamento) é opcional e ocorre apenas DEPOIS que o cadastro inicial estiver concluído. Se o usuário salvar direto da primeira aba, o sistema deve preencher e salvar os padrões de parcelas (1 parcela 100%) e rateio (100% no Centro de Custo do título ou padrão) em segundo plano, sem bloquear o botão Salvar ou exibir mensagens pedindo para ir para outras abas.

---

## 🏛️ 7. Arquitetura Financeira em 3 Camadas & 11 Regras de Ouro

### 🏗️ Arquitetura em 3 Camadas
1. **Dimensões**: `pessoa` (clientes e fornecedores unificados com flags `is_cliente` e `is_fornecedor`), `plano_conta`, `centro_custo`, `conta_bancaria`.
2. **Documento**: `titulo` (com `tipo`: 'P' = pagar, 'R' = receber) → `titulo_parcela` → `titulo_rateio`.
3. **Caixa**: `movimento` (a baixa efetiva do título).

### 🏆 As 11 Regras de Ouro (Não Negociáveis)
1. **Estrutura Única de Títulos**: Contas a Pagar e Receber são a mesma estrutura (`titulo`), diferenciados apenas por `titulo.tipo` ('P' | 'R'). Sem duplicação de tabelas ou telas.
2. **Pessoas Unificadas**: Clientes e Fornecedores na mesma tabela (`pessoa`) com flags `is_cliente` e `is_fornecedor`.
3. **Cálculo de Saldo**: A baixa nunca altera a parcela. Saldo é sempre calculado: `saldo = valor - soma(movimentos não estornados)`.
4. **Status Derivado**: O status nunca é digitado ou fixado manualmente. É derivado de `saldo` + `data_vencimento`: `aberto` | `parcial` | `pago` | `vencido` | `cancelado`.
5. **Rateio em 100%**: O rateio por centro de custo deve somar exatamente 100% da parcela. O salvamento é bloqueado se não fechar.
6. **Três Datas Distintas**: `competencia` (DRE/regime contábil), `vencimento` (previsão de caixa), `pagamento` (caixa realizado).
7. **Pagamentos Parciais**: Uma parcela pode ter múltiplos movimentos de caixa.
8. **Encargos e Descontos**: Juros, multa e desconto pertencem ao `movimento`, nunca ao `titulo`.
9. **Soft Delete & Estornos**: Nada é excluído fisicamente (`ativo = false` para registros, `estornado = true` para movimentos).
10. **Apenas Nós-Folha**: Em `plano_conta` e `centro_custo`, apenas nós-folha (`aceita_lancamento = true`) recebem lançamentos.
11. **Fluxo de Caixa e Dashboard**: Apenas leitura, sem digitação nem tabela própria (são consultas agregadas sobre as camadas 1, 2 e 3).

### 💵 Valores e Datas
- Valores monetários: `NUMERIC(15,2)` ou inteiros em centavos no repositório. Nunca `float`.
- Datas: `DATE` (sem hora), exceto `created_at`/`updated_at` (`TIMESTAMPTZ`).
- Formatação visual: `pt-BR`, `R$ 1.234,56` e `dd/mm/aaaa`.

