import { ExclusaoOrcamentoPrevia } from '../types';

/**
 * A recusa de exclusão, em texto, a partir da prévia.
 *
 * Fica fora dos repositórios porque os dois (Supabase e mock) precisam recusar
 * com a MESMA frase: o mock é o caminho de validação do projeto, e divergência
 * de mensagem entre eles já escondeu comportamento diferente antes.
 *
 * São dois bloqueios de naturezas distintas e a mensagem diz qual é:
 * - revisão apontando para esta planilha como base (`orcamento_base_id`);
 * - apropriação de título em itens dela (`titulo_rateio.orcamento_item_id`).
 */
export function mensagemRecusaExclusao(previa: ExclusaoOrcamentoPrevia): string {
  if (previa.revisoesDependentes) {
    return (
      `"${previa.orcamentoNome}" não pode ser excluído: ele é a base da revisão ` +
      `${previa.revisoesDependentes}. Exclua a revisão primeiro, ou encerre este orçamento ` +
      'em vez de excluir.'
    );
  }

  const codigos = [...new Set(previa.bloqueios.map((b) => b.tituloCodigo))];
  return (
    `"${previa.orcamentoNome}" não pode ser excluído: ${previa.bloqueios.length} apropriação(ões) ` +
    `apontam para itens dele (título ${codigos.join(', ')}). ` +
    'Retire a apropriação desses títulos, ou encerre o orçamento em vez de excluir.'
  );
}
