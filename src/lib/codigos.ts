/**
 * Geração de código sequencial para os cadastros.
 *
 * Regra: código é sempre numérico, crescente e gerado pelo sistema — nunca
 * digitado. Em cadastros hierárquicos o filho herda o código do pai e recebe
 * o próximo número dentro daquele ramo (ex.: "001" → "001.01").
 *
 * Parte sempre do MAIOR código existente, não da quantidade de registros:
 * contar linhas faz o contador retroceder quando algo é excluído e gera
 * colisão com a constraint UNIQUE. Foi exatamente o defeito que quebrou a
 * criação de títulos.
 */

interface ItemComCodigo {
  codigo: string;
  parentId?: string | null;
}

/** Extrai o último segmento numérico de um código ("001.12" → 12). */
function ultimoSegmento(codigo: string): number {
  const partes = codigo.split('.');
  const numero = parseInt((partes[partes.length - 1] || '').replace(/\D/g, ''), 10);
  return Number.isNaN(numero) ? 0 : numero;
}

/**
 * Próximo código disponível.
 *
 * @param itens      todos os registros já cadastrados
 * @param parent     nó pai, quando o cadastro for hierárquico
 * @param digitos    zeros à esquerda (3 na raiz, 2 nos filhos, por padrão)
 */
export function proximoCodigo(
  itens: ItemComCodigo[],
  parent?: { id: string; codigo: string } | null,
  digitos?: { raiz?: number; filho?: number }
): string {
  const padRaiz = digitos?.raiz ?? 3;
  const padFilho = digitos?.filho ?? 2;

  /*
   * Códigos que não entram na contagem.
   *
   * "CC-999" é o sentinela do centro de custo "Não alocado", reservado e fora
   * da sequência: incluí-lo faria o próximo código saltar para 1000 — e, com o
   * campo somente-leitura, sem como corrigir pela tela.
   *
   * Códigos legados COM prefixo e numeração real (CC-001, CC-002) continuam
   * contando, para a numeração seguir de onde parou em vez de recomeçar do 1 e
   * conviver com dois formatos.
   */
  const RESERVADOS = new Set(['CC-999']);
  const somenteNumerico = (codigo: string) => !RESERVADOS.has(codigo);

  if (!parent) {
    const maior = itens
      .filter((i) => !i.parentId && somenteNumerico(i.codigo))
      .reduce((m, i) => Math.max(m, ultimoSegmento(i.codigo.split('.')[0])), 0);
    return String(maior + 1).padStart(padRaiz, '0');
  }

  // Filho: continua a numeração dentro do ramo do pai
  const irmaos = itens.filter((i) => i.parentId === parent.id && somenteNumerico(i.codigo));
  const maior = irmaos.reduce((m, i) => Math.max(m, ultimoSegmento(i.codigo)), 0);

  // O irmão manda no formato: sem isto um novo nível 2 do plano de contas sairia
  // "1.03" ao lado de "1.1" e "1.2".
  const larguraIrmao = irmaos.length > 0
    ? (irmaos[0].codigo.split('.').pop() || '').length
    : padFilho;

  return `${parent.codigo}.${String(maior + 1).padStart(larguraIrmao, '0')}`;
}
