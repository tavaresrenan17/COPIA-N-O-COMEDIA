import type { CentroCusto, TipoCentroCusto } from '@/data';

/**
 * As Unidades Construtivas fixas de toda obra.
 *
 * Lista fechada, definida pelo negócio — não é sugestão nem ponto de partida.
 * Toda obra nasce com estas e só com estas.
 *
 * Mora aqui, e não na tela de Centro de Custos, por dois motivos: é regra de
 * negócio consumida por mais de uma tela, e exportá-la de um `page.tsx` é
 * proibido pelo Next.js — foi o que derrubou o build da Vercel.
 */
export const UNIDADES_PADRAO_OBRA = [
  'MÃO DE OBRA',
  'IMPOSTOS',
  'ENGENHARIA',
  'ADMINISTRATIVO',
  'DIRETORIA',
  'TRIAGEM',
];

/**
 * O centro de custo tem lista FIXA de Unidades Construtivas?
 *
 * Só o tipo `obra`. As unidades saem de `UNIDADES_PADRAO_OBRA`, nascem junto
 * com a obra e não se acrescenta outra pela tela de Orçamento — é o que
 * `aceitaUnidadeLivre` recusa.
 */
export function temUnidadesFixas(tipo?: TipoCentroCusto | null): boolean {
  return tipo === 'obra';
}

/**
 * O centro de custo aceita Unidade Construtiva criada à mão?
 *
 * Dois tipos, pelo mesmo motivo: as unidades saem do desenho de cada operação,
 * não de uma lista fechada.
 *
 * - `centro_custo_obra` — o híbrido, que opera como obra física E como centro
 *   de custo financeiro autônomo (TORRE 1, ÁREA COMUM...);
 * - `frota` — cada máquina é uma unidade construtiva (RETROESCAVADEIRA NEW
 *   HOLLAND, MINIESCAVADEIRA CASE...). É o mesmo formato que o ERP de
 *   referência usa: a frota é uma "obra" cujas unidades são os equipamentos, e
 *   cada equipamento tem a sua planilha de itens.
 *
 * Os demais recusam: `obra` tem lista fixa (`UNIDADES_PADRAO_OBRA`), e
 * `centro_custo`, `administrativo` e `comercial` não têm unidade construtiva.
 */
export function aceitaUnidadeLivre(tipo?: TipoCentroCusto | null): boolean {
  return tipo === 'centro_custo_obra' || tipo === 'frota';
}

/**
 * As Unidades Construtivas de um centro de custo — os filhos ativos dele.
 *
 * Unidade Construtiva não é entidade própria: é um `centro_custo` com
 * `parentId` preenchido, na mesma árvore. Esta função é o único lugar que
 * precisa saber disso.
 */
export function unidadesConstrutivasDe(centros: CentroCusto[], centroCustoId: string): CentroCusto[] {
  return centros
    .filter((c) => c.parentId === centroCustoId && c.ativo)
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
}

/**
 * Código de um Item de Orçamento, no formato do ERP de referência.
 *
 * Lá os itens ficam sob o grupo `01 CUSTOS` e recebem uma sequência
 * (`01.000.000.001`, `01.000.000.002`...). Aqui a forma é a mesma, encurtada:
 * `01.001`, `01.002`. O grupo é só prefixo — `orcamento_item` não tem
 * hierarquia — e o campo continua editável na tela.
 *
 * Não passa por `proximoCodigo` (src/lib/codigos.ts), que numera `CentroCusto`
 * dentro do ramo do pai; item de orçamento numera dentro da unidade e pode
 * repetir o mesmo código em unidades diferentes.
 */
export function codigoItemOrcamento(ordem: number): string {
  return `01.${String(ordem).padStart(3, '0')}`;
}
