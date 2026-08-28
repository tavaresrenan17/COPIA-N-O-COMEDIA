import type { LucideIcon } from 'lucide-react';
import { BarChart3, Building2, UserRound } from 'lucide-react';
import { DEPARTMENTS, DepartmentConfig, DepartmentModule } from '@/data/departments';

/**
 * Registro de navegação do app.
 *
 * Fonte única do que existe, como se chama e onde fica. Antes essa informação
 * estava em três lugares: a estrutura em `departments.ts`, um mapa de 41
 * títulos dentro do Topbar, e a busca de departamento ativo copiada igual entre
 * Topbar e Sidebar — que já vinham divergindo entre si.
 *
 * Duas visões, de propósito:
 * - **tudo** (`rotasConhecidas`, `tituloDaRota`, `paginaAnterior`) enxerga
 *   inclusive o que está `inativo`. Esconder do menu não é remover do app: quem
 *   chega por link direto numa tela desligada ainda precisa de título na aba e
 *   de um botão Voltar que funcione.
 * - **visível** (`secoesNavegacao`, `itensVisiveis`) descarta o que está
 *   `inativo`, e é o que alimenta menu, busca e favoritos.
 */

export interface ItemNavegacao {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Nome da seção a que pertence — a busca casa por ele também. */
  secao: string;
}

export interface SecaoNavegacao {
  id: string;
  titulo: string;
  itens: ItemNavegacao[];
}

/**
 * Rotas de topo, fora de qualquer departamento. Batem com os itens globais que a
 * sidebar mostra na Home.
 */
const ROTAS_TOPO = ['/cadastros', '/departamentos', '/relatorios'];

/**
 * Títulos de tela, quando o rótulo do menu é curto demais para a barra de cima.
 * "Credores" serve de item de menu; "Cadastro de Credores" serve de título.
 * Rota que não estiver aqui cai no rótulo do próprio `departments.ts`.
 */
const TITULOS_DE_ROTA: Record<string, string> = {
  '/': '',
  '/departamentos': 'Hub de Departamentos',
  '/cadastros': 'Bases de Cadastros',
  '/relatorios': 'Relatórios Executivos',
  '/orcamentos': 'Orçamento de Obra',
  '/contas-pagar': 'Contas a Pagar',
  '/contas-receber': 'Contas a Receber',
  '/fluxo-caixa': 'Fluxo de Caixa',
  '/recorrencias': 'Lançamentos Recorrentes',
  '/conciliacao': 'Conciliação Bancária',
  '/clientes': 'Cadastro de Clientes',
  '/fornecedores': 'Cadastro de Fornecedores',
  '/centro-custos': 'Centro de Custos',
  '/plano-contas': 'Plano Financeiro',
  '/contas-bancarias': 'Contas Bancárias',
  '/usuarios': 'Gestão de Usuários e Permissões',
  '/perfil': 'Meu Perfil',
  '/subempresas': 'Subempresas',
  '/departamentos/financeiro': 'Visão Geral do Financeiro',
  '/departamentos/rh': 'Visão Geral do RH',
  '/departamentos/rh/colaboradores': 'Quadro de Colaboradores',
  '/departamentos/rh/folha': 'Folha de Pagamento',
  '/departamentos/rh/ferias': 'Férias & Registro de Ponto',
  '/departamentos/rh/beneficios': 'Gestão de Benefícios',
  '/departamentos/juridico': 'Visão Geral do Jurídico',
  '/departamentos/juridico/contratos': 'Gestão de Contratos',
  '/departamentos/juridico/processos': 'Acompanhamento Processual',
  '/departamentos/juridico/compliance': 'Compliance & Certidões CND',
  '/departamentos/fiscal': 'Visão Geral do Fiscal',
  '/departamentos/fiscal/notas': 'Notas Fiscais (NF-e)',
  '/departamentos/fiscal/apuracao': 'Apuração Tributária',
  '/departamentos/fiscal/guias': 'Guias de Recolhimento',
  '/departamentos/comercial': 'Visão Geral do Comercial',
  '/departamentos/comercial/pedidos': 'Pedidos de Venda',
  '/departamentos/comercial/tabela-precos': 'Tabela de Preços',
  '/pessoas': 'Cadastro de Credores',
  '/relatorios/executivo': 'Dashboard Executivo',
  '/orcamentos/acompanhamento': 'Acompanhamento Orçamentário',
  '/cadastros/grupos-gestao': 'Grupos de Gestão',
  '/cadastros/linhas-gestao': 'Linhas de Gestão',
  '/contas-pagar/cadastro': 'Novo Título a Pagar',
  '/contas-receber/cadastro': 'Novo Título a Receber',
};

/** `/contas-pagar` prefixa `/contas-pagar/cadastro`, mas não `/contas-pagar-x`. */
function ehPrefixo(rota: string, caminho: string): boolean {
  if (rota === '/') return true;
  return caminho === rota || caminho.startsWith(rota + '/');
}

/** Todas as rotas que a navegação conhece — inclusive as desligadas. */
function rotasConhecidas(): string[] {
  const rotas = new Set<string>(ROTAS_TOPO);
  for (const dept of Object.values(DEPARTMENTS)) {
    rotas.add(dept.baseHref);
    for (const m of dept.modules) if (m.href !== '/') rotas.add(m.href);
    for (const c of dept.cadastros) if (c.href !== '/') rotas.add(c.href);
  }
  return [...rotas];
}

/** O rótulo do hub de um departamento — usado pelo menu E pelo título da tela. */
function rotuloDoHub(dept: DepartmentConfig): string {
  return dept.hubLabel ?? dept.name;
}

/** Rótulo de cada rota conhecida, ignorando o `inativo`. */
function rotulosDeTodasAsRotas(): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const dept of Object.values(DEPARTMENTS)) {
    mapa.set(dept.baseHref, rotuloDoHub(dept));
    for (const m of [...dept.modules, ...dept.cadastros]) {
      if (m.href !== '/' && !mapa.has(m.href)) mapa.set(m.href, m.label);
    }
  }
  return mapa;
}

/** O departamento dono de uma rota EXATA de módulo ou cadastro. */
function departamentoDaRotaExata(rota: string) {
  return Object.values(DEPARTMENTS).find(
    (d) => d.modules.some((m) => m.href === rota) || d.cadastros.some((c) => c.href === rota)
  );
}

/**
 * O departamento em que a rota atual está, por prefixo.
 *
 * Estava copiado igual em Topbar e Sidebar.
 */
export function departamentoAtivo(caminho: string): DepartmentConfig | undefined {
  return Object.values(DEPARTMENTS).find((dept) => {
    if (ehPrefixo(dept.baseHref, caminho)) return true;
    if (dept.modules.some((m) => m.href !== '/' && ehPrefixo(m.href, caminho))) return true;
    if (dept.cadastros.some((c) => c.href !== '/' && ehPrefixo(c.href, caminho))) return true;
    return false;
  });
}

/**
 * As seções do menu, já sem nada desligado.
 *
 * Uma seção por departamento ativo, mais "Sistema" no fim. Módulo `inativo`
 * some junto com o departamento `inativo`: a navegação passa a mostrar só o que
 * funciona, em vez de listar telas que não abrem.
 */
export function secoesNavegacao(): SecaoNavegacao[] {
  const secoes: SecaoNavegacao[] = [];
  // `/orcamentos` pertence a Financeiro e a Comercial: fica na primeira seção
  // que o reivindicar, para não aparecer duas vezes quando ambos estiverem ativos.
  const jaUsadas = new Set<string>();

  const adicionar = (itens: ItemNavegacao[], m: DepartmentModule, secao: string) => {
    if (m.inativo || m.href === '/' || jaUsadas.has(m.href)) return;
    jaUsadas.add(m.href);
    itens.push({ href: m.href, label: m.label, Icon: m.Icon, secao });
  };

  for (const [id, dept] of Object.entries(DEPARTMENTS)) {
    if (dept.inativo) continue;

    const itens: ItemNavegacao[] = [];

    // O hub do departamento entra primeiro, quando não é um dos módulos.
    if (!dept.modules.some((m) => m.href === dept.baseHref) && !jaUsadas.has(dept.baseHref)) {
      jaUsadas.add(dept.baseHref);
      itens.push({
        href: dept.baseHref,
        label: rotuloDoHub(dept),
        Icon: dept.Icon,
        secao: dept.name,
      });
    }

    for (const m of dept.modules) adicionar(itens, m, dept.name);
    for (const c of dept.cadastros) adicionar(itens, c, dept.name);

    if (itens.length > 0) secoes.push({ id, titulo: dept.name, itens });
  }

  secoes.push({
    id: 'sistema',
    titulo: 'Sistema',
    itens: [
      { href: '/departamentos', label: 'Departamentos', Icon: Building2, secao: 'Sistema' },
      { href: '/relatorios', label: 'Relatórios', Icon: BarChart3, secao: 'Sistema' },
    ].filter((i) => !jaUsadas.has(i.href)),
  });

  return secoes.filter((s) => s.itens.length > 0);
}

/**
 * Telas que existem e funcionam, mas não têm entrada própria no menu — moram
 * dentro de outra tela. Ficam de fora da sidebar e DENTRO da busca: quem digita
 * "executivo" espera chegar ao dashboard, não receber "nenhuma tela encontrada".
 */
const TELAS_SEM_MENU: { href: string; Icon: LucideIcon }[] = [
  { href: '/relatorios/executivo', Icon: BarChart3 },
  { href: '/orcamentos/acompanhamento', Icon: BarChart3 },
  { href: '/perfil', Icon: UserRound },
];

/** Tudo que o menu mostra, numa lista só. */
export function itensVisiveis(): ItemNavegacao[] {
  return secoesNavegacao().flatMap((s) => s.itens);
}

/** O que a busca varre: o menu inteiro mais as telas que moram dentro de outras. */
export function itensBuscaveis(): ItemNavegacao[] {
  const doMenu = itensVisiveis();
  const jaTem = new Set(doMenu.map((i) => i.href));

  const extras = TELAS_SEM_MENU.filter((t) => !jaTem.has(t.href)).map((t) => ({
    href: t.href,
    label: tituloDaRota(t.href),
    Icon: t.Icon,
    secao: 'Telas',
  }));

  return [...doMenu, ...extras];
}

/** A seção que contém a rota atual — a que o menu abre sozinho. */
export function secaoDaRota(caminho: string): string | null {
  const secoes = secoesNavegacao();
  let melhor: { id: string; tamanho: number } | null = null;

  for (const secao of secoes) {
    for (const item of secao.itens) {
      if (!ehPrefixo(item.href, caminho)) continue;
      if (!melhor || item.href.length > melhor.tamanho) {
        melhor = { id: secao.id, tamanho: item.href.length };
      }
    }
  }
  return melhor?.id ?? null;
}

/** Título da tela, para a barra de cima e para o título da aba. */
export function tituloDaRota(caminho: string): string {
  const exato = TITULOS_DE_ROTA[caminho];
  if (exato !== undefined) return exato;

  const rotulo = rotulosDeTodasAsRotas().get(caminho);
  if (rotulo) return rotulo;

  // Tela de detalhe herda o título da tela que a contém (`/contas-pagar/cadastro/123`).
  const prefixo = Object.keys(TITULOS_DE_ROTA)
    .filter((rota) => rota !== '/' && caminho.startsWith(`${rota}/`))
    .sort((a, b) => b.length - a.length)[0];

  return prefixo ? TITULOS_DE_ROTA[prefixo] : 'ERP MVP';
}

/**
 * A página que vem imediatamente acima desta na hierarquia do app.
 *
 * NÃO é o histórico do navegador. `router.back()` desfaz a última navegação,
 * qualquer que tenha sido: quem lançou um título e voltou para a listagem
 * caía de novo dentro do cadastro daquele título já salvo, e quem abriu o
 * sistema direto numa URL profunda não ia a lugar nenhum, porque não havia
 * histórico para desfazer. Subir pela hierarquia é sempre o mesmo caminho,
 * independente de como a pessoa chegou aqui.
 *
 * Enxerga também as rotas desligadas: some do menu, mas continua subindo.
 *
 * Devolve `null` na Home, onde não há para onde subir.
 *
 * - `/contas-pagar/cadastro/123` → `/contas-pagar`   (detalhe → listagem)
 * - `/contas-pagar`              → `/departamentos/financeiro`  (módulo → hub)
 * - `/departamentos/financeiro`  → `/departamentos`  (hub → índice)
 * - `/departamentos`             → `/`
 */
export function paginaAnterior(caminho: string): string | null {
  const atual = caminho.replace(/\/+$/, '') || '/';
  if (atual === '/') return null;

  // A rota conhecida mais específica que contém o caminho atual.
  const maisEspecifica = rotasConhecidas()
    .filter((r) => ehPrefixo(r, atual))
    .sort((a, b) => b.length - a.length)[0];

  if (!maisEspecifica) {
    // Rota fora do mapa: sobe um segmento e para na Home.
    const pai = atual.slice(0, atual.lastIndexOf('/'));
    return pai || '/';
  }

  // Estamos MAIS FUNDO que a rota conhecida — é uma tela de detalhe dela.
  if (atual !== maisEspecifica) return maisEspecifica;

  // Estamos exatamente na rota conhecida: sobe um nível na estrutura.
  if (ROTAS_TOPO.includes(atual)) return '/';

  const dept = departamentoDaRotaExata(atual);
  if (dept && dept.baseHref !== atual) return dept.baseHref;

  // É o hub de um departamento (ou um baseHref que também é rota de topo).
  const ehBaseHref = Object.values(DEPARTMENTS).some((d) => d.baseHref === atual);
  if (ehBaseHref) return ROTAS_TOPO.includes(atual) ? '/' : '/departamentos';

  return '/';
}
