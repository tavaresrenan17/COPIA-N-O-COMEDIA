import type { PlanoConta } from '@/data';

/**
 * As contas de nível 2 que servem para item de orçamento.
 *
 * Orçamento de obra é de CUSTO — conta de receita não entra. Sem este filtro, a
 * primeira conta por código é "1.01 Receita operacional" e todo item nasce
 * classificado em receita; o título a pagar apropriado nesse item herda a conta
 * de receita e o repositório recusa a gravação, com o erro aparecendo no título,
 * longe de onde nasceu.
 *
 * O segundo critério (código com dois segmentos e que não aceita lançamento)
 * cobre plano de contas cujo `nivel` não foi preenchido: é o mesmo nó, alcançado
 * pela forma do código.
 */
export function planosDeCusto(planos: PlanoConta[]): PlanoConta[] {
  const ehCusto = (p: PlanoConta) => p.natureza !== 'receita';

  const nivel2 = planos.filter(
    (p) => ehCusto(p) && (p.nivel === 2 || (p.codigo.split('.').length === 2 && !p.aceitaLancamento))
  );

  return nivel2.length > 0 ? nivel2 : planos.filter((p) => ehCusto(p) && p.nivel === 2);
}
