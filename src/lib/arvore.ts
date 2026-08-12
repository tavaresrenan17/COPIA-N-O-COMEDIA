/**
 * Utilitários dos cadastros em árvore (centro de custo, plano de contas).
 */

export interface NoArvore {
  id: string;
  parentId?: string | null;
  nivel: number;
}

/**
 * IDs de todos os descendentes de um nó, em qualquer profundidade.
 *
 * Usado para tirar do seletor de "pai" o próprio nó e sua subárvore: escolher
 * um descendente como pai cria um ciclo, e a montagem da árvore simplesmente
 * descarta o ramo — ele some da tela sem erro e sem como desfazer.
 */
export function descendentesDe<T extends NoArvore>(itens: T[], id: string): Set<string> {
  const filhosPorPai = new Map<string, T[]>();
  for (const item of itens) {
    if (!item.parentId) continue;
    const lista = filhosPorPai.get(item.parentId) ?? [];
    lista.push(item);
    filhosPorPai.set(item.parentId, lista);
  }

  const encontrados = new Set<string>();
  const fila = [id];
  while (fila.length > 0) {
    for (const filho of filhosPorPai.get(fila.pop()!) ?? []) {
      if (encontrados.has(filho.id)) continue;   // proteção contra ciclo pré-existente
      encontrados.add(filho.id);
      fila.push(filho.id);
    }
  }
  return encontrados;
}

/**
 * Recalcula o nível de toda a subárvore a partir do nível do nó raiz informado.
 *
 * Necessário ao mover um nó de lugar: só o próprio registro recebia o nível
 * novo, e os descendentes ficavam com a profundidade antiga — desalinhando a
 * indentação da árvore e qualquer relatório que agrupe por nível.
 *
 * Devolve os pares `{ id, nivel }` que precisam ser gravados.
 */
export function recalcularNiveis<T extends NoArvore>(
  itens: T[],
  raizId: string,
  nivelRaiz: number
): { id: string; nivel: number }[] {
  const filhosPorPai = new Map<string, T[]>();
  for (const item of itens) {
    if (!item.parentId) continue;
    const lista = filhosPorPai.get(item.parentId) ?? [];
    lista.push(item);
    filhosPorPai.set(item.parentId, lista);
  }

  const ajustes: { id: string; nivel: number }[] = [];
  const visitados = new Set<string>([raizId]);
  const fila: { id: string; nivel: number }[] = [{ id: raizId, nivel: nivelRaiz }];

  while (fila.length > 0) {
    const atual = fila.pop()!;
    for (const filho of filhosPorPai.get(atual.id) ?? []) {
      if (visitados.has(filho.id)) continue;
      visitados.add(filho.id);
      const nivelFilho = atual.nivel + 1;
      if (filho.nivel !== nivelFilho) ajustes.push({ id: filho.id, nivel: nivelFilho });
      fila.push({ id: filho.id, nivel: nivelFilho });
    }
  }
  return ajustes;
}
