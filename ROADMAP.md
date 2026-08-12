# Roteiro de Evolução — ERP "Melhor Gestão"

Documento de trabalho. A ordem importa: cada fase depende da anterior.
Marque `[x]` conforme concluir.

---

## Situação atual (baseline)

| Indicador | Valor |
|---|---|
| Linhas de TypeScript/TSX | 26.673 |
| Métodos no contrato `IErpRepository` | 116 |
| Métodos que ainda devolvem dados do mock em memória | **70 de 126 (56%)** |
| Controle de versão | **nenhum** |
| Testes automatizados | **nenhum** |
| CI | **nenhum** |
| Autenticação | `localStorage` (sem backend) |
| RLS no banco | `USING (true)` — chave anônima com acesso total |

### Já concluído

- [x] Auditoria do banco real (projeto `pmsdmbmxjckjpmbrilri`, região `sa-east-1`)
- [x] `supabase/migrations/08_correcoes_consistencia.sql` — correção de inconsistências (**não aplicada ainda**)
- [x] `supabase/schema_completo.sql` reescrito como fonte única da verdade
- [x] `supabase/DICIONARIO_DADOS.md` — mapeamento variável ↔ coluna
- [x] Migrations 01–07 e `migration_auth.sql` marcadas como histórico
- [x] Correções no repositório: natureza do plano de contas, código sequencial, rateio com plano de contas, `created_by` do operador
- [x] Performance: filtros empurrados para o Postgres, debounce na busca, proteção contra resposta fora de ordem, cache de cadastros
- [x] Sidebar fixa (padrão app shell) e simplificada

---

## Fase 0 — Fundação  ⏱ 10 minutos

> Tudo depois disso depende daqui. Hoje não há como desfazer nada:
> o versionamento é por cópia de pasta (o diretório se chama literalmente "CÓPIA").

- [ ] **`git init`** na raiz do projeto
- [ ] Criar **`.gitignore`** antes do primeiro commit:
      ```
      node_modules/
      .next/
      .env*.local
      tsconfig.tsbuildinfo
      ```
- [ ] Primeiro commit com o estado atual
- [ ] Criar repositório remoto (privado) e enviar

> ⚠️ Sem o `.gitignore`, o `.env.local` com a chave do Supabase vai para o repositório.

---

## Fase 1 — Banco de dados  ⏱ 1 hora

- [ ] Aplicar **`supabase/migrations/08_correcoes_consistencia.sql`** no SQL Editor
      *(o app já depende dela: `titulo.codigo` agora vem da sequence do banco)*
- [ ] Rodar as **4 queries de conferência** do rodapé da migration — todas devem
      retornar 0 linhas:
      - nível do plano de contas incoerente com o código
      - título a pagar em conta de receita (e vice-versa)
      - soma das parcelas diferente do valor do título
      - rateio de parcela que não fecha 100%
- [ ] **Decidir a reclassificação dos 3 títulos** hoje em `1.1.01 Locação de
      equipamentos` (natureza receita, sendo contas a pagar). Sugestão na seção 6
      da migration: `2.3.02` para os dois de mecânica, `3.1.04` para o "TESTE"
- [ ] **Cadastrar ao menos uma conta bancária** — `conta_bancaria` está vazia e
      `movimento.conta_bancaria_id` é `NOT NULL`: hoje nenhuma baixa é possível
- [ ] Teste ponta a ponta: criar um título `P` e um `R`, conferir o código gerado,
      o rateio com plano de contas, e dar uma baixa

---

## Fase 2 — Segurança (Passo 5)  ⏱ 1 semana

> **Fazer antes de a primeira nota fiscal real entrar no sistema.**
> Hoje a autenticação é `localStorage`, a chave anônima está no bundle do
> navegador e o RLS é `USING (true)`. Somando: qualquer pessoa com a URL abre o
> devtools e tem leitura e escrita em todo o banco financeiro.

- [ ] Migrar `AuthContext` de `localStorage` para **Supabase Auth** (`@supabase/ssr`)
- [ ] Vincular `usuario_perfil.auth_user_id` ao `auth.users(id)`
- [ ] Proteção de rotas por middleware
- [ ] **Endurecer o RLS**: trocar `USING (true)` por `auth.role() = 'authenticated'`
      (bloco comentado na seção 18 do `schema_completo.sql`)
- [ ] Trocar `created_by` / `updated_by` de TEXT livre para
      `UUID REFERENCES usuario_perfil(id)`
      *(hoje convivem "Fabrício (Administrador)" e "Renan (Administrativo)…" para o mesmo papel)*
- [ ] Aplicar permissão por departamento (`usuario_departamento`) na navegação

---

## Fase 3 — Sair do mock (concluir o Passo 4)  ⏱ 3 a 4 semanas

> **A maior dívida do projeto.** 56% da API devolve dados em memória. As telas
> abrem, mostram números plausíveis e perdem tudo ao recarregar. Num sistema
> financeiro, tela com número fictício é pior que tela ausente — alguém decide
> com base nela.

### 3.1 Decisão de arquitetura (fazer primeiro)

- [ ] **Definir o destino do `fallbackMock`.**
      Recomendação: fallback só em desenvolvimento; em produção o erro sobe para a
      tela. Hoje, quando uma consulta ao Supabase falha, o repositório loga
      `console.warn` e devolve mock — falha e sucesso ficam indistinguíveis.
      Ver `supabase.repository.ts`, método `getPessoas`.

### 3.2 Migração módulo a módulo (ordem por valor)

- [ ] **Fluxo de Caixa** — `getFluxoCaixa`
- [ ] **Dashboard executivo** — hoje só os 2 primeiros blocos persistem;
      curva de 90 dias, despesas por centro de custo, por plano de contas e
      top 5 voltam vazios
- [ ] **Orçamento** — `getOrcamentos`, `getOrcamentoExecucao`,
      `validarDisponibilidadeOrcamentaria` e correlatos
- [ ] **Recorrências** — depende das tabelas `recorrencia*` criadas na migration 08
- [ ] **Conciliação bancária** — importação OFX, motor de casamento, regras
- [ ] `getMovimentosPorParcela` e `getFeriados`
- [ ] **`centrosCustoFormatado`** — está fixo em `'Não alocado'` no repositório;
      deve ser montado a partir de `titulo_rateio`

### 3.3 Consequência

- [ ] Remover `mock.repository.ts` do bundle de produção
      *(3.597 linhas — uma segunda implementação completa do domínio, mantida em
      paralelo e enviada ao navegador do usuário)*

---

## Fase 4 — Qualidade  ⏱ 1 semana

- [ ] **Testes de integridade** a partir das queries de conferência da migration 08:
      - soma das parcelas = valor do título
      - rateio fechando 100% por parcela
      - natureza do plano de contas coerente com o tipo do título
      - nível do plano de contas coerente com o código
      > Esta é exatamente a classe de bug que chegou ao banco real sem ninguém notar.
- [ ] Testes de repositório contra um Supabase de staging
- [ ] **CI no GitHub Actions**: `tsc --noEmit` + `next build` + testes a cada push
- [ ] Criar um **projeto Supabase de staging** — nesta sessão os testes rodaram
      contra o banco de produção

---

## Fase 5 — Arquitetura e performance  ⏱ 2 semanas

> Só faz sentido **depois** de medir em produção (`npm run build && npm start`).
> Em modo dev, a primeira visita a cada rota compila sob demanda (8 a 18 s) —
> isso não existe em produção.

- [ ] Medir com build de produção antes de otimizar qualquer coisa
- [ ] Converter listagens de `'use client'` para **Server Components**
      *(44 das 46 páginas são client-side: o navegador baixa 240–350 kB de JS e
      hidrata antes de a primeira consulta sair)*
- [ ] Import dinâmico do **Recharts** (`/orcamentos` carrega 348 kB)
- [ ] Quebrar os arquivos grandes:
      - `CadastroTituloPage.tsx` — 1.854 linhas
      - `recorrencias/page.tsx` — 1.615 linhas
      - `conciliacao/page.tsx` — 1.044 linhas
- [ ] Avaliar subir o tier do banco: a instância **NANO** apresenta picos
      ocasionais de ~360 ms mesmo com conexão aberta (p50 fica em 27–47 ms)

---

## Fase 6 — Deploy  ⏱ 1 semana

- [ ] VPS Hostinger: PM2 + Nginx + HTTPS
- [ ] Variáveis de ambiente no servidor (nunca no repositório)
- [ ] Backup automático do Supabase
- [ ] Monitoramento de erros (Sentry ou equivalente)

---

## Backlog — dívidas menores

- [ ] **Tabela `titulo_auditoria`** — `Titulo.logsAudit` só existe em memória
- [ ] **Tabela `titulo_anexo`** + Supabase Storage — anexos hoje viram texto
      concatenado no campo `observacao`
- [ ] Separar `serie` do **tipo de documento** (o campo acumula os dois significados)
- [ ] Tornar o **Plano de Contas obrigatório** no cadastro de título — em branco,
      o sistema ainda escolhe uma conta por você (agora ao menos da natureza certa)
- [ ] Tabela de ligação para conciliação N:1 (borderô) —
      `ExtratoLancamento.movimentosAgrupadosIds` não tem coluna
- [ ] Revisar `pessoa.is_cliente` / `is_fornecedor`: quase todos os cadastros
      estão com as duas flags verdadeiras
- [ ] Página inicial: a geolocalização tem timeout de 15 s e dispara duas APIs
      externas em sequência (open-meteo + bigdatacloud)

---

## Regras de trabalho combinadas

1. **Auditar o banco real antes de qualquer alteração que grave dados.**
   Os arquivos `.sql` deste repositório descrevem a **intenção**, não o estado:
   a migration 08 está pendente. Assumir que ela foi aplicada quebrou o
   salvamento três vezes seguidas:

   | Coluna assumida | Erro que o usuário viu |
   |---|---|
   | `titulo.codigo` (DEFAULT da sequence) | `null value in column "codigo" violates not-null constraint` |
   | `titulo_rateio.plano_conta_id` | `Could not find the 'plano_conta_id' column in the schema cache` |
   | `pessoa.categoria_fornecedor` | (quebraria no cadastro de pessoa) |

   **Procedimento:**
   1. Extrair todas as colunas escritas pelo repositório (payloads de
      `.insert()` / `.update()` e atribuições a `payload.<col>`).
   2. Sondar cada uma no banco real: `?select=<coluna>&limit=1` no PostgREST
      devolve erro `42703` quando a coluna não existe. A chave anônima do
      `.env.local` basta para leitura.
   3. Coluna que só existe após migração pendente entra por checagem em tempo
      de execução — `temColuna(tabela, coluna)` em
      `src/data/supabase/supabase.repository.ts` — nunca às cegas. O app precisa
      funcionar antes e depois da migração.

2. **`tsc` limpo e rota em 200 não provam que a tela funciona.** As páginas são
   client components; o HTML do servidor não contém formulário preenchido nem
   aba condicional. Para cada campo obrigatório novo, confirmar que existe
   controle **dentro do bloco da aba** que o exige. Para regra que depende de
   dados, confirmar que o dado existe — exigir rateio sem centro de custo
   cadastrado tornou o formulário insolúvel.

3. **Revisar o próprio trabalho antes de entregar.** Terminada a correção,
   rodar `/code-review high` sobre o diff e corrigir o que aparecer. Atenção
   redobrada quando a correção **destrava um caminho antes inerte** — campo que
   passa a ser gravado, botão que passa a funcionar: é onde os bugs latentes
   acordam. Ao consertar `updateCentroCusto`, que gravava só `nome` e `ativo`,
   a revisão apontou 7 problemas, vários criados pela própria correção. O `tsc`
   estava limpo em todos eles.

4. **Medir antes de concluir.** Dois diagnósticos furaram por amostra pequena:
   "banco distante" era ruído de rede (está em `sa-east-1` e responde em 27 ms),
   e uma invalidação de cache foi colocada antes da escrita em vez de depois.
   Ambos só apareceram na segunda medição.

5. **Não escrever no banco de produção em teste sem avisar antes**, e limpar o
   resíduo. Não existe staging — o `.env.local` aponta para o banco do cliente.

6. **Nunca rodar `next build` com o `next dev` ligado** — os dois escrevem em
   `.next/` e o build corrompe o dev server (sintoma: erros de
   `React Client Manifest` e 500 em todas as rotas).
