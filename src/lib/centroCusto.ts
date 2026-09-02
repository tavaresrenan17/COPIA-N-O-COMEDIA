import type { TipoCentroCusto } from '@/data';

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
 * Só o híbrido `centro_custo_obra`, que opera como obra física E como centro
 * de custo financeiro autônomo: ali as unidades são do desenho de cada
 * operação (TORRE 1, ÁREA COMUM...), não uma lista fechada.
 *
 * Os demais tipos — `obra` (lista fixa), `centro_custo`, `administrativo`,
 * `frota` e `comercial` (que não têm unidade construtiva nenhuma) — recusam.
 */
export function aceitaUnidadeLivre(tipo?: TipoCentroCusto | null): boolean {
  return tipo === 'centro_custo_obra';
}
