import type { TipoCentroCusto } from '@/data';

/**
 * O centro de custo é uma OBRA?
 *
 * São dois tipos, não um: `obra` e `centro_custo_obra`. A regra estava escrita
 * à mão em cada tela que precisava dela — e uma quarta cópia, no editor de
 * orçamento, é o que deixava o botão "+ Nova Unidade" aparecer em centro de
 * custo administrativo, de frota ou comercial.
 *
 * Unidade Construtiva (MÃO DE OBRA, IMPOSTOS, TORRE 1...) só existe dentro de
 * obra: é o que a geração automática de unidades padrão em Centro de Custos já
 * assumia.
 */
export function ehTipoObra(tipo?: TipoCentroCusto | null): boolean {
  return tipo === 'obra' || tipo === 'centro_custo_obra';
}
