'use client';

import { useEffect, useState } from 'react';
import { erpRepository, CentroCusto, TipoCentroCusto, Subempresa } from '@/data';
import { TreeView, TreeNode } from '@/components/TreeView';
import { Search, Plus, X, PieChart, Calendar, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { proximoCodigo } from '@/lib/codigos';
import { descendentesDe, recalcularNiveis } from '@/lib/arvore';

export default function CentroCustosPage() {
  const [centrosAtivos, setCentrosAtivos] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [apenasAtivos, setApenasAtivos] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formTipo, setFormTipo] = useState<TipoCentroCusto>('obra');
  const [formAceitaLancamento, setFormAceitaLancamento] = useState(true);
  const [formDataInicio, setFormDataInicio] = useState('');
  const [formDataFim, setFormDataFim] = useState('');
  /** Lista sem filtro — usada no seletor de pai e no cálculo de nível. */
  const [centrosTodos, setCentrosTodos] = useState<CentroCusto[]>([]);

  useEffect(() => {
    loadData();
  }, [apenasAtivos]);

  async function loadData() {
    setLoading(true);
    // A lista completa alimenta o seletor de pai e o cálculo de nível: com o
    // filtro "apenas ativos" ligado, um pai inativo sumia e o nível saía errado.
    const [ccList, todos] = await Promise.all([
      erpRepository.getCentrosCusto({ apenasAtivos }),
      erpRepository.getCentrosCusto({ apenasAtivos: false }),
    ]);
    setCentrosAtivos(ccList);
    setCentrosTodos(todos);
    setLoading(false);
  }

  const handleOpenNewModal = (parent?: TreeNode) => {
    setEditingId(null);
    if (parent) {
      setFormParentId(parent.id);
      setFormTipo((parent as any).tipo || 'obra');
      setFormCodigo(proximoCodigo(centrosTodos, parent));
    } else {
      setFormParentId('');
      // Antes: `CC-${centrosAtivos.length + 1}` — contar linhas fazia o número
      // retroceder após uma exclusão e colidir com o código único.
      setFormCodigo(proximoCodigo(centrosTodos));
      setFormTipo('obra');
    }
    setFormNome('');
    setFormAceitaLancamento(true);
    setFormDataInicio('');
    setFormDataFim('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (node: TreeNode) => {
    const item = centrosAtivos.find((cc) => cc.id === node.id);
    if (!item) return;
    setEditingId(item.id);
    setFormCodigo(item.codigo);
    setFormNome(item.nome);
    setFormParentId(item.parentId || '');
    setFormTipo(item.tipo);
    setFormAceitaLancamento(item.aceitaLancamento);
    setFormDataInicio(item.dataInicio || '');
    setFormDataFim(item.dataFim || '');
    setModalOpen(true);
  };

  /** Descendentes do nó em edição — não podem ser oferecidos como pai. */
  const subarvoreEditada = editingId
    ? descendentesDe(centrosTodos, editingId)
    : new Set<string>();

  /**
   * Vocabulário da tela: o nó de topo é o "Centro de Custo"; tudo que pendura
   * abaixo dele é uma "Linha de Centro de Custo". É o vínculo selecionado que
   * define qual dos dois está sendo cadastrado — por isso deriva do formulário,
   * e não do registro carregado: trocar o vínculo no modal já troca os rótulos.
   */
  const ehLinha = formParentId !== '';
  const rotuloRegistro = ehLinha ? 'Linha de Centro de Custo' : 'Centro de Custo';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    /*
     * O nível vem do PAI, não do formato do código.
     *
     * Antes era `formCodigo.split('.').length`: criar "CC-002" sob um pai
     * gerava nível 1 com parent_id preenchido — filho declarado como raiz.
     * É o mesmo defeito que deixou o plano de contas com "3.1.01" no nível 2.
     */
    const pai = formParentId ? centrosTodos.find((cc) => cc.id === formParentId) : null;
    if (formParentId && !pai) {
      // Sem o pai em mãos o nível sairia 1 com parent_id preenchido — justamente
      // o "filho declarado como raiz" que esta correção existe para evitar.
      alert('Não foi possível identificar o Centro de Custo desta linha. Recarregue a tela e tente de novo.');
      return;
    }
    const nivel = pai ? pai.nivel + 1 : 1;

    const payload = {
      codigo: formCodigo,
      nome: formNome,
      parentId: formParentId || null,
      tipo: formTipo,
      nivel,
      aceitaLancamento: formAceitaLancamento,
      dataInicio: formDataInicio || null,
      dataFim: formDataFim || null,
      ativo: true
    };

    try {
      if (editingId) {
        await erpRepository.updateCentroCusto(editingId, payload);
      } else {
        await erpRepository.createCentroCusto(payload);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível salvar o centro de custo.');
      return;
    }

    // Mover um nó muda a profundidade de tudo abaixo dele.
    if (editingId) {
      for (const ajuste of recalcularNiveis(centrosTodos, editingId, nivel)) {
        try {
          await erpRepository.updateCentroCusto(ajuste.id, { nivel: ajuste.nivel });
        } catch {
          /* nível é cosmético na árvore: não vale abortar o salvamento por ele */
        }
      }
    }

    /*
     * Nó que ganhou filho deixa de aceitar lançamento.
     *
     * Sem isso o custo poderia ser lançado no pai E nos filhos, e o total do
     * pai somaria as duas coisas — dobrando o valor no relatório.
     */
    // O CC-999 "Não alocado" é o destino padrão do sistema: rebaixá-lo a
    // agrupador tiraria o único lugar onde títulos sem obra podem cair.
    // Identificado pelo código, que é igual nos dois repositórios — o id muda
    // (UUID no Supabase, "cc-999" no mock) e comparar por id deixava o mock passar.
    const ehNaoAlocado = (pai?.codigo || '').replace(/\D/g, '') === '999';
    if (pai && pai.aceitaLancamento && !ehNaoAlocado) {
      try {
        await erpRepository.updateCentroCusto(pai.id, { aceitaLancamento: false });
      } catch {
        // O filho já foi gravado: avisar sem travar o usuário num modal que,
        // ao ser reenviado, esbarraria no código único.
        alert('A linha foi salva, mas não foi possível marcar o Centro de Custo como agrupador. Ajuste manualmente.');
      }
    }

    setModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja desativar este centro de custos? (Soft delete)')) {
      await erpRepository.deleteCentroCusto(id);
      loadData();
    }
  };

  const getTipoBadge = (tipo: TipoCentroCusto) => {
    switch (tipo) {
      case 'obra':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">Obra</span>;
      case 'administrativo':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">Admin</span>;
      case 'frota':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">Frota</span>;
      case 'comercial':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 uppercase">Comercial</span>;
    }
  };

  const treeNodes: TreeNode[] = centrosAtivos
    .filter((cc) => {
      if (!searchTerm) return true;
      return cc.nome.toLowerCase().includes(searchTerm.toLowerCase()) || cc.codigo.includes(searchTerm);
    })
    .map((cc) => ({
      id: cc.id,
      codigo: cc.codigo,
      nome: cc.nome,
      parentId: cc.parentId,
      nivel: cc.nivel,
      aceitaLancamento: cc.aceitaLancamento,
      ativo: cc.ativo,
      tipo: cc.tipo,
      subempresaId: cc.subempresaId,
      metaBadge: (
        <div className="flex items-center gap-1.5">
          {cc.subempresaNome && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-purple-700" />
              {cc.subempresaNome}
            </span>
          )}
          {getTipoBadge(cc.tipo)}
        </div>
      ),
      subInfo: cc.dataInicio ? (
        <span className="text-[10px] text-ink-muted flex items-center gap-1 font-medium bg-surface-muted px-2 py-0.5 rounded-md">
          <Calendar className="w-3 h-3" />
          {cc.dataInicio} {cc.dataFim ? `até ${cc.dataFim}` : ''}
        </span>
      ) : undefined
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">Centro de Custos (Obras & Projetos)</h1>
          <p className="text-xs text-ink-muted mt-1">
            Cada Centro de Custo se ramifica em Linhas de Centro de Custo, por empresa vinculada e tipo de operação (Obras, Frota, Administrativo e Comercial).
          </p>
        </div>
        <button
          onClick={() => handleOpenNewModal()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Centro de Custo</span>
        </button>
      </div>

      {/* Busca, Filtro por Empresa e Ativos */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:w-80">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por código ou nome de centro de custos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface border border-black/[0.06] rounded-xl pl-10 pr-4 py-2 text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 shadow-soft"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
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
      </div>

      {/* Árvore de Centro de Custos */}
      <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03]">
        {loading ? (
          <div className="p-12 text-center text-ink-muted font-medium">Carregando centro de custos...</div>
        ) : treeNodes.length === 0 ? (
          <div className="p-12 text-center text-ink-muted">Nenhum centro de custo encontrado.</div>
        ) : (
          <TreeView
            nodes={treeNodes}
            rotuloFilho="Linha de Centro de Custo"
            onAddChild={handleOpenNewModal}
            onEdit={handleOpenEditModal}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Modal: Formulário de Centro de Custos */}
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
                  {editingId ? `Editar ${rotuloRegistro}` : `${ehLinha ? 'Nova' : 'Novo'} ${rotuloRegistro}`}
                </h3>
                <button onClick={() => setModalOpen(false)} className="text-ink-muted hover:text-ink-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Centro de Custo</label>
                  <select
                    value={formParentId}
                    onChange={(e) => {
                      const novoPai = centrosTodos.find((c) => c.id === e.target.value) || null;
                      setFormParentId(e.target.value);
                      // O código depende do ramo: sem regenerar, um código de raiz ia parar
                      // num filho e o número voltava a ser oferecido — violando o UNIQUE,
                      // sem conserto pela tela, já que o campo é somente-leitura.
                      // Vale também na edição: o código pertence ao ramo. Mantê-lo ao mover deixava
                      // um código de raiz preso num filho e o número voltava a ser oferecido.
                      setFormCodigo(proximoCodigo(centrosTodos.filter((c) => c.id !== editingId), novoPai));
                    }}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Nenhum — cadastrar um Centro de Custo</option>
                    {centrosTodos
                      // Fora: o próprio nó, sua subárvore (viraria ciclo e o ramo
                      // sumiria da tela) e os inativos (o filho apareceria solto
                      // na raiz, com indentação errada).
                      .filter(
                        (cc) =>
                          // O pai já selecionado continua na lista mesmo inativo:
                          // sumir dele fazia o select exibir "Nenhum (Nó Raiz)"
                          // enquanto o vínculo antigo seguia gravado.
                          (cc.ativo || cc.id === formParentId) &&
                          cc.id !== editingId &&
                          !subarvoreEditada.has(cc.id)
                      )
                      .map((cc) => (
                        <option key={cc.id} value={cc.id}>
                          {cc.codigo} - {cc.nome}
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-ink-muted mt-1">
                    {ehLinha
                      ? 'Este registro será uma Linha do Centro de Custo selecionado.'
                      : 'Sem vínculo, o registro é um Centro de Custo — as Linhas são cadastradas dentro dele.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Código *</label>
                    <input
                      type="text"
                      placeholder="CC-001"
                      value={formCodigo}
                      readOnly

                      title="Código gerado automaticamente pelo sistema"
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Tipo de Operação *</label>
                    <select
                      value={formTipo}
                      onChange={(e) => setFormTipo(e.target.value as TipoCentroCusto)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="obra">Obra / Projeto</option>
                      <option value="administrativo">Administrativo</option>
                      <option value="frota">Frota & Equipamentos</option>
                      <option value="comercial">Comercial</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Nome d{ehLinha ? 'a' : 'o'} {rotuloRegistro} *</label>
                  <input
                    type="text"
                    placeholder="Ex: Residencial Villa Alpina"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                {/* Vigência / Datas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Data Início</label>
                    <input
                      type="date"
                      value={formDataInicio}
                      onChange={(e) => setFormDataInicio(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Data Término</label>
                    <input
                      type="date"
                      value={formDataFim}
                      onChange={(e) => setFormDataFim(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                {/* Flag aceita_lancamento */}
                <div className="bg-surface-muted p-3 rounded-xl border border-black/5">
                  <label className="flex items-center gap-2 text-xs font-bold text-ink-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAceitaLancamento}
                      onChange={(e) => setFormAceitaLancamento(e.target.checked)}
                      className="rounded border-gray-300 text-brand focus:ring-brand w-4 h-4"
                    />
                    <span>Aceita Lançamento</span>
                  </label>
                  <p className="text-[11px] text-ink-muted mt-1">
                    Ao ganhar a primeira Linha, o Centro de Custo vira agrupador e deixa de
                    aceitar rateio direto — o custo passa a ser lançado nas Linhas.
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
                    Salvar {rotuloRegistro}
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
