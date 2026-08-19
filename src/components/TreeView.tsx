'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Plus, Edit2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export interface TreeNode {
  id: string;
  codigo: string;
  nome: string;
  parentId?: string | null;
  nivel: number;
  aceitaLancamento: boolean;
  ativo: boolean;
  metaBadge?: React.ReactNode;
  subInfo?: React.ReactNode;
  filhos?: TreeNode[];
}

interface TreeViewProps {
  nodes: TreeNode[];
  onAddChild?: (parent: TreeNode) => void;
  onEdit?: (node: TreeNode) => void;
  onDelete?: (id: string) => void;
  /**
   * Nome que cada tela dá ao item de baixo (ex.: "Linha de Centro de Custo").
   * A árvore é compartilhada, então o padrão continua genérico.
   */
  rotuloFilho?: string;
}

export function TreeView({ nodes, onAddChild, onEdit, onDelete, rotuloFilho = 'sub-item' }: TreeViewProps) {
  // Converte a lista plana em estrutura de árvore caso ainda não esteja aninhada
  const buildTree = (flatList: TreeNode[]): TreeNode[] => {
    const map = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    flatList.forEach((node) => {
      map.set(node.id, { ...node, filhos: [] });
    });

    flatList.forEach((node) => {
      const mappedNode = map.get(node.id)!;
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.filhos!.push(mappedNode);
      } else {
        roots.push(mappedNode);
      }
    });

    return roots;
  };

  const treeData = nodes.some(n => n.filhos && n.filhos.length > 0) ? nodes : buildTree(nodes);

  return (
    <div className="space-y-1">
      {treeData.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          rotuloFilho={rotuloFilho}
        />
      ))}
    </div>
  );
}

function TreeNodeItem({
  node,
  onAddChild,
  onEdit,
  onDelete,
  rotuloFilho,
}: {
  node: TreeNode;
  onAddChild?: (parent: TreeNode) => void;
  onEdit?: (node: TreeNode) => void;
  onDelete?: (id: string) => void;
  rotuloFilho: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.filhos && node.filhos.length > 0;

  return (
    <div className="select-none">
      <div
        className={`group flex items-center justify-between py-2.5 px-3 rounded-xl transition-all border border-transparent ${
          !node.ativo ? 'opacity-50 bg-gray-50' : 'hover:bg-white hover:shadow-soft hover:border-black/[0.04]'
        }`}
        style={{ paddingLeft: `${(node.nivel - 1) * 1.5 + 0.75}rem` }}
      >
        {/* Lado Esquerdo: Expansão + Ícone + Código + Nome */}
        <div className="flex items-center gap-2.5 min-w-0">
          {hasChildren ? (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 rounded-md text-ink-muted hover:bg-black/5 transition-transform"
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-6" /> // Espaçamento se não houver filhos
          )}

          {/* Ícone de Pasta (Pai) ou Arquivo (Folha) */}
          {!node.aceitaLancamento ? (
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
          )}

          {/* Código e Nome */}
          <span className="font-mono text-xs font-bold text-ink-primary shrink-0 bg-surface-muted px-2 py-0.5 rounded-md border border-black/5">
            {node.codigo}
          </span>
          <span className={`text-xs text-ink-primary truncate ${!node.aceitaLancamento ? 'font-bold' : 'font-medium'}`}>
            {node.nome}
          </span>

          {/* Badges de Meta Informações (Natureza/Tipo) */}
          {node.metaBadge}
        </div>

        {/* Lado Direito: Indicador aceita_lancamento + SubInfo + Ações */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Indicador de Aceita Lançamento */}
          {node.aceitaLancamento ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Lançável
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" />
              Agrupador (Não lançável)
            </span>
          )}

          {node.subInfo}

          {/* Ações (Editar, Adicionar Filho, Excluir)
              Antes ficavam em opacity-0 até o hover — invisíveis no toque e
              inalcançáveis por teclado. Agora ficam discretas, mas sempre presentes. */}
          <div className="opacity-60 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 transition-opacity">
            {onAddChild && !node.aceitaLancamento && (
              <button
                type="button"
                onClick={() => onAddChild(node)}
                title={`Adicionar ${rotuloFilho}`}
                aria-label={`Adicionar ${rotuloFilho} em ${node.nome}`}
                className="p-1.5 rounded-lg text-ink-muted hover:text-brand hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(node)}
                title="Editar item"
                aria-label={`Editar ${node.nome}`}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand transition-all"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                title="Desativar item (Soft delete)"
                aria-label={`Desativar ${node.nome}`}
                className="p-1.5 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nós Filhos (Recursividade) */}
      {hasChildren && isOpen && (
        <div className="space-y-1">
          {node.filhos!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              rotuloFilho={rotuloFilho}
            />
          ))}
        </div>
      )}
    </div>
  );
}
