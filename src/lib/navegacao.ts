import { DEPARTMENTS } from '@/data/departments';

/**
 * Rotas de topo, fora de qualquer departamento. Batem com os itens globais que a
 * sidebar mostra na Home.
 */
const ROTAS_TOPO = ['/cadastros', '/departamentos', '/relatorios'];

/** `/contas-pagar` prefixa `/contas-pagar/cadastro`, mas não `/contas-pagar-x`. */
function ehPrefixo(rota: string, caminho: string): boolean {
  if (rota === '/') return true;
  return caminho === rota || caminho.startsWith(rota + '/');
}

/** Todas as rotas que a navegação conhece, sem repetição. */
function rotasConhecidas(): string[] {
  const rotas = new Set<string>(ROTAS_TOPO);
  for (const dept of Object.values(DEPARTMENTS)) {
    rotas.add(dept.baseHref);
    for (const m of dept.modules) if (m.href !== '/') rotas.add(m.href);
    for (const c of dept.cadastros) if (c.href !== '/') rotas.add(c.href);
  }
  return [...rotas];
}

/** O departamento dono de uma rota exata de módulo ou cadastro. */
function departamentoDaRota(rota: string) {
  return Object.values(DEPARTMENTS).find(
    (d) => d.modules.some((m) => m.href === rota) || d.cadastros.some((c) => c.href === rota)
  );
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

  const dept = departamentoDaRota(atual);
  if (dept && dept.baseHref !== atual) return dept.baseHref;

  // É o hub de um departamento (ou um baseHref que também é rota de topo).
  const ehBaseHref = Object.values(DEPARTMENTS).some((d) => d.baseHref === atual);
  if (ehBaseHref) return ROTAS_TOPO.includes(atual) ? '/' : '/departamentos';

  return '/';
}
