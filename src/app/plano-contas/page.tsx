'use client';

import { useEffect, useState } from 'react';
import { erpRepository, PlanoConta, NaturezaPlanoConta } from '@/data';
import { TreeView, TreeNode } from '@/components/TreeView';
import { Search, Plus, X, FolderTree, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PlanoContasPage() {
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [apenasAtivos, setApenasAtivos] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formNatureza, setFormNatureza] = useState<NaturezaPlanoConta>('despesa');
  const [formAceitaLancamento, setFormAceitaLancamento] = useState(true);

  useEffect(() => {
    loadData();
  }, [apenasAtivos]);

  async function loadData() {
    setLoading(true);
    const data = await erpRepository.getPlanoContas({ apenasAtivos });
    setPlanoContas(data);
    setLoading(false);
  }

  const handleOpenNewModal = (parent?: TreeNode) => {
    setEditingId(null);
    if (parent) {
      setFormParentId(parent.id);
      setFormNatureza((parent as any).natureza || 'despesa');
      setFormCodigo(`${parent.codigo}.`);
    } else {
      setFormParentId('');
      setFormCodigo('');
      setFormNatureza('despesa');
    }
    setFormNome('');
    setFormAceitaLancamento(true);
    setModalOpen(true);
  };

  const handleOpenEditModal = (node: TreeNode) => {
    const item = planoContas.find((p) => p.id === node.id);
    if (!item) return;
    setEditingId(item.id);
    setFormCodigo(item.codigo);
    setFormNome(item.nome);
    setFormParentId(item.parentId || '');
    setFormNatureza(item.natureza);
    setFormAceitaLancamento(item.aceitaLancamento);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Calcula o nível com base nos pontos do código
    const nivel = formCodigo.split('.').filter(Boolean).length || 1;

    const payload = {
      codigo: formCodigo,
      nome: formNome,
      parentId: formParentId || null,
      natureza: formNatureza,
      nivel,
      aceitaLancamento: formAceitaLancamento,
      ativo: true
    };

    if (editingId) {
      await erpRepository.updatePlanoConta(editingId, payload);
    } else {
      await erpRepository.createPlanoConta(payload);
    }

    setModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja desativar esta conta contábil? (Soft delete)')) {
      await erpRepository.deletePlanoConta(id);
      loadData();
    }
  };

  // Prepara badges visuais para a árvore
  const getNaturezaBadge = (natureza: NaturezaPlanoConta) => {
    switch (natureza) {
      case 'receita':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">Receita</span>;
      case 'custo':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 uppercase">Custo</span>;
      case 'despesa':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">Despesa</span>;
      case 'investimento':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">Investimento</span>;
    }
  };

  // Mapeia para nós da TreeView
  const treeNodes: TreeNode[] = planoContas
    .filter((pc) => {
      if (!searchTerm) return true;
      return pc.nome.toLowerCase().includes(searchTerm.toLowerCase()) || pc.codigo.includes(searchTerm);
    })
    .map((pc) => ({
      id: pc.id,
      codigo: pc.codigo,
      nome: pc.nome,
      parentId: pc.parentId,
      nivel: pc.nivel,
      aceitaLancamento: pc.aceitaLancamento,
      ativo: pc.ativo,
      natureza: pc.natureza,
      metaBadge: getNaturezaBadge(pc.natureza)
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">Plano de Contas (DRE / Regime Contábil)</h1>
          <p className="text-xs text-ink-muted mt-1">
            Estrutura hierárquica em árvore de Receitas, Custos, Despesas e Investimentos com trava de lançamento em nós-pai.
          </p>
        </div>
        <button
          onClick={() => handleOpenNewModal()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Conta Contábil</span>
        </button>
      </div>

      {/* Controles de Busca e Filtro */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:w-80">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por código ou nome de conta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface border border-black/[0.06] rounded-xl pl-10 pr-4 py-2 text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 shadow-soft"
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted bg-surface px-3 py-2 rounded-xl border border-black/[0.06] shadow-soft cursor-pointer">
          <input
            type="checkbox"
            checked={apenasAtivos}
            onChange={(e) => setApenasAtivos(e.target.checked)}
            className="rounded border-gray-300 text-brand focus:ring-brand"
          />
          Apenas Ativos
        </label>
      </div>

      {/* Árvore de Plano de Contas */}
      <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03]">
        {loading ? (
          <div className="p-12 text-center text-ink-muted font-medium">Carregando plano de contas...</div>
        ) : treeNodes.length === 0 ? (
          <div className="p-12 text-center text-ink-muted">Nenhuma conta contábil encontrada.</div>
        ) : (
          <TreeView
            nodes={treeNodes}
            onAddChild={handleOpenNewModal}
            onEdit={handleOpenEditModal}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Modal: Formulário de Plano de Contas */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl border border-black/10"
            >
              <div className="flex items-center justify-between mb-5 border-b border-black/5 pb-3">
                <h3 className="text-lg font-bold text-ink-primary">
                  {editingId ? 'Editar Conta Contábil' : 'Nova Conta Contábil'}
                </h3>
                <button onClick={() => setModalOpen(false)} className="text-ink-muted hover:text-ink-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Conta Pai (Agrupador)</label>
                  <select
                    value={formParentId}
                    onChange={(e) => {
                      setFormParentId(e.target.value);
                      const parent = planoContas.find((p) => p.id === e.target.value);
                      if (parent) {
                        setFormNatureza(parent.natureza);
                      }
                    }}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Nenhuma (Nó Raiz / Nível 1)</option>
                    {planoContas
                      .filter((p) => !p.aceitaLancamento) // Apresenta apenas nós agrupadores como opção de Pai
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo} - {p.nome}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Código Struct *</label>
                    <input
                      type="text"
                      placeholder="Ex: 1.1.01"
                      value={formCodigo}
                      onChange={(e) => setFormCodigo(e.target.value)}
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Natureza DRE *</label>
                    <select
                      value={formNatureza}
                      onChange={(e) => setFormNatureza(e.target.value as NaturezaPlanoConta)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="receita">Receita</option>
                      <option value="custo">Custo</option>
                      <option value="despesa">Despesa</option>
                      <option value="investimento">Investimento</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Nome da Conta *</label>
                  <input
                    type="text"
                    placeholder="Descrição da conta"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Regra de Ouro #10: Flag aceita_lancamento */}
                <div className="bg-surface-muted p-3 rounded-xl border border-black/5">
                  <label className="flex items-center gap-2 text-xs font-bold text-ink-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAceitaLancamento}
                      onChange={(e) => setFormAceitaLancamento(e.target.checked)}
                      className="rounded border-gray-300 text-brand focus:ring-brand w-4 h-4"
                    />
                    <span>Aceita Lançamento (Nó Folha)</span>
                  </label>
                  <p className="text-[11px] text-ink-muted mt-1">
                    Se desmarcado, esta conta funcionará como **Nó Agrupador/Pai** e ficará bloqueada de receber lançamentos de títulos.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-black/5">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98]"
                  >
                    Salvar Conta
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
