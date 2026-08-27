/**
 * Casamento entre um rateio de parcela e um item de orçamento.
 *
 * Um centro de custo pode ter MAIS DE UM orçamento ao mesmo tempo — obras
 * paralelas, não revisões uma da outra (o `versao` é carimbado por centro de
 * custo em `proximaVersaoOrcamento`, então o segundo orçamento nasce "v2" sem
 * ser revisão de nada). Por isso o vínculo do consumo é o `orcamentoItemId`, e
 * só ele: o item pertence a um orçamento único, o centro de custo não.
 *
 * A regra anterior caía para o centro de custo quando o rateio não tinha item,
 * e com dois orçamentos no mesmo CC o mesmo lançamento era somado como consumo
 * nos dois — o dinheiro aparecia gasto em dobro. O que não aponta item agora vai
 * para `rateiosSemItem` e é reportado à parte, sem consumir orçamento nenhum.
 *
 * Estas funções são usadas pelos quatro pontos que faziam a mesma conta à mão
 * (comprometido e realizado, no repositório Supabase e no mock) — que estavam
 * divergindo em silêncio: o mock ainda checava plano de contas no fallback, o
 * Supabase não.
 */

/**
 * Rateio nas duas grafias que existem no projeto: a do banco (`snake_case`, como
 * o PostgREST devolve) e a do domínio (`camelCase`, usada pelo mock).
 */
export interface RateioBruto {
  orcamento_item_id?: string | null;
  orcamentoItemId?: string | null;
  centro_custo_id?: string | null;
  centroCustoId?: string | null;
  percentual?: number | string | null;
}

export interface RateioCasado<T> {
  rateio: T;
  /** Percentual do rateio, já normalizado. Rateio sem percentual vale 100%. */
  percentual: number;
}

const itemDoRateio = (rat: RateioBruto): string | null =>
  rat.orcamento_item_id ?? rat.orcamentoItemId ?? null;

const centroCustoDoRateio = (rat: RateioBruto): string | null =>
  rat.centro_custo_id ?? rat.centroCustoId ?? null;

/**
 * Rateio sem percentual gravado é o rateio integral — é assim que os dois
 * repositórios já tratavam (`Number(r.percentual) || 100`).
 *
 * Zero explícito, porém, é zero. O `|| 100` de antes transformava um rateio de
 * 0,00% em consumo de 100% da parcela, e o formulário aceita salvar um par
 * `100 + 0` (ele só cobra que a soma feche 100). Com o `.filter()`, essa linha
 * de 0% passou a ser somada de verdade em vez de ser ignorada pelo `.find()`.
 */
const percentualDoRateio = (rat: RateioBruto): number => {
  const bruto = rat.percentual;
  if (bruto === null || bruto === undefined || bruto === '') return 100;
  const n = Number(bruto);
  // Valor ilegível continua valendo como rateio integral, como antes.
  return Number.isFinite(n) ? n : 100;
};

/**
 * Os rateios de uma parcela que consomem este item de orçamento.
 *
 * Devolve TODOS (não o primeiro): uma parcela pode ser rateada entre dois itens
 * do mesmo orçamento, e o `.find()` que existia antes contava só um deles.
 */
export function rateiosDoItem<T extends RateioBruto>(
  rateios: readonly T[] | null | undefined,
  itemId: string | undefined
): RateioCasado<T>[] {
  if (!itemId) return [];
  return (rateios || [])
    .filter((rat) => itemDoRateio(rat) === itemId)
    .map((rat) => ({ rateio: rat, percentual: percentualDoRateio(rat) }));
}

/**
 * Os rateios de uma parcela que caem na árvore do centro de custo do orçamento
 * mas não apontam item nenhum — ou seja, não consomem orçamento.
 *
 * `centroCustoTreeIds` é o centro de custo do orçamento mais suas unidades
 * construtivas, como os repositórios já montavam.
 */
export function rateiosSemItem<T extends RateioBruto>(
  rateios: readonly T[] | null | undefined,
  centroCustoTreeIds: readonly string[]
): RateioCasado<T>[] {
  return (rateios || [])
    .filter((rat) => {
      if (itemDoRateio(rat)) return false;
      const cc = centroCustoDoRateio(rat);
      return !!cc && centroCustoTreeIds.includes(cc);
    })
    .map((rat) => ({ rateio: rat, percentual: percentualDoRateio(rat) }));
}
