'use client';

import { useEffect, useState } from 'react';
import { erpRepository, CentroCusto, TipoCentroCusto, Subempresa, GrupoGestao, LinhaGestao } from '@/data';
import { TreeView, TreeNode } from '@/components/TreeView';
import { Search, Plus, X, PieChart, Calendar, Building2, Layers, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { proximoCodigo } from '@/lib/codigos';
import { descendentesDe, recalcularNiveis } from '@/lib/arvore';

const UNIDADES_PADRAO_OBRA = [
  'MÃO DE OBRA',
  'IMPOSTOS',
  'ENGENHARIA',
  'ADMINISTRATIVO',
  'DIRETORIA',
];

export default function CentroCustosPage() {
  const [centrosAtivos, setCentrosAtivos] = useState<CentroCusto[]>([]);
  const [gruposGestao, setGruposGestao] = useState<GrupoGestao[]>([]);
  const [linhasGestao, setLinhasGestao] = useState<LinhaGestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [apenasAtivos, setApenasAtivos] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal Gerar Unidades Padrão
  const [modalGerarPadraoOpen, setModalGerarPadraoOpen] = useState(false);
  const [obraIdGerarPadrao, setObraIdGerarPadrao] = useState('');
  const [gerandoPadrao, setGerandoPadrao] = useState(false);

  // Form State
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formTipo, setFormTipo] = useState<TipoCentroCusto>('centro_custo_obra');
  const [formAutoGerarUnidades, setFormAutoGerarUnidades] = useState(true);
  const [formGrupoGestaoId, setFormGrupoGestaoId] = useState<string>('');
  const [formLinhaGestaoId, setFormLinhaGestaoId] = useState<string>('');
  /** Linhas de gestão do Grupo Macro. Vazio + global = vale para todas. */
  const [formLinhasIds, setFormLinhasIds] = useState<string[]>([]);
  const [formEscopoGlobal, setFormEscopoGlobal] = useState(false);
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
    const [ccList, todos, ggList, lgList] = await Promise.all([
      erpRepository.getCentrosCusto({ apenasAtivos }),
      erpRepository.getCentrosCusto({ apenasAtivos: false }),
      erpRepository.getGruposGestao({ apenasAtivos: true }),
      erpRepository.getLinhasGestao(undefined, { apenasAtivos: false }),
    ]);
    setCentrosAtivos(ccList);
    setCentrosTodos(todos);
    setGruposGestao(ggList);
    setLinhasGestao(lgList);
    setLoading(false);
  }

  const getLinhaVinculadaDoCentroOuAncestrais = (centroId?: string | null) => {
    let atualId = centroId;
    while (atualId) {
      const centro = centrosTodos.find((c) => c.id === atualId);
      // O vínculo mora no centro de custo; a unidade construtiva herda o da obra.
      const primeira = (centro?.linhasGestaoIds ?? [])[0];
      if (primeira) {
        const linha = linhasGestao.find((l) => l.id === primeira);
        if (linha) return linha;
      }
      atualId = centro?.parentId;
    }
    return null;
  };

  const handleOpenNewModal = (parent?: TreeNode) => {
    setEditingId(null);
    if (parent) {
      setFormParentId(parent.id);
      setFormTipo((parent as any).tipo || 'obra');
      setFormCodigo(proximoCodigo(centrosTodos, parent));
      setFormAutoGerarUnidades(false);

      // Herda automaticamente o Grupo e a Linha de Gestão da Obra de origem
      const linhaPai = getLinhaVinculadaDoCentroOuAncestrais(parent.id);
      if (linhaPai) {
        setFormGrupoGestaoId(linhaPai.grupoGestaoId);
        setFormLinhaGestaoId(linhaPai.id);
        setFormLinhasIds([linhaPai.id]);
      } else {
        setFormGrupoGestaoId('');
        setFormLinhaGestaoId('');
        setFormLinhasIds([]);
      }
      setFormEscopoGlobal(false);
    } else {
      setFormParentId('');
      setFormCodigo(proximoCodigo(centrosTodos));
      setFormTipo('centro_custo_obra');
      setFormAutoGerarUnidades(true);
      setFormGrupoGestaoId('');
      setFormLinhaGestaoId('');
      setFormLinhasIds([]);
      setFormEscopoGlobal(false);
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
    setFormAutoGerarUnidades(false);
    setFormAceitaLancamento(item.aceitaLancamento);
    setFormDataInicio(item.dataInicio || '');
    setFormDataFim(item.dataFim || '');

    /*
     * Linha do próprio centro de custo ou herdada da obra-mãe. Precisa ser
     * carregada aqui: sem isto o campo abria vazio ao editar e salvar apagava o
     * vínculo, já que o formulário grava o que está na tela.
     */
    setFormLinhasIds(item.linhasGestaoIds ?? []);
    setFormEscopoGlobal(!!item.escopoGlobal);

    const linhaVinculada = getLinhaVinculadaDoCentroOuAncestrais(item.id);
    if (linhaVinculada) {
      setFormGrupoGestaoId(linhaVinculada.grupoGestaoId);
      setFormLinhaGestaoId(linhaVinculada.id);
    } else {
      setFormGrupoGestaoId('');
      setFormLinhaGestaoId('');
    }

    setModalOpen(true);
  };

  /** Descendentes do nó em edição — não podem ser oferecidos como pai. */
  const subarvoreEditada = editingId
    ? descendentesDe(centrosTodos, editingId)
    : new Set<string>();

  /**
   * Vocabulário dinâmico da tela:
   */
  const ehLinha = formParentId !== '';
  const rotuloRegistro = ehLinha
    ? 'Unidade Construtiva'
    : formTipo === 'centro_custo'
    ? 'Centro de Custo'
    : formTipo === 'obra'
    ? 'Obra'
    : 'Centro de Custo & Obra';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const pai = formParentId ? centrosTodos.find((cc) => cc.id === formParentId) : null;
    if (formParentId && !pai) {
      alert('Não foi possível identificar o Centro de Custo / Obra pai. Recarregue a tela e tente de novo.');
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
      escopoGlobal: formParentId ? false : formEscopoGlobal,
      linhasGestaoIds: formParentId ? [] : formEscopoGlobal ? [] : formLinhasIds,
      dataInicio: formDataInicio || null,
      dataFim: formDataFim || null,
      ativo: true,
    };

    let centroCustoSalvoId = editingId;

    try {
      if (editingId) {
        await erpRepository.updateCentroCusto(editingId, payload);
      } else {
        const novoCC = await erpRepository.createCentroCusto(payload);
        centroCustoSalvoId = novoCC.id;

        // Se for uma Obra nova (raiz) e estiver configurada para gerar unidades padrão:
        const ehObra = formTipo === 'obra' || formTipo === 'centro_custo_obra';
        if (ehObra && !formParentId && formAutoGerarUnidades) {
          let listaAtual = [...centrosTodos, novoCC];
          for (const nomeUnidade of UNIDADES_PADRAO_OBRA) {
            const cod = proximoCodigo(
              listaAtual,
              { id: novoCC.id, codigo: novoCC.codigo } as any
            );
            const novaUnidade = await erpRepository.createCentroCusto({
              codigo: cod,
              nome: nomeUnidade,
              parentId: novoCC.id,
              tipo: 'obra',
              nivel: novoCC.nivel + 1,
              aceitaLancamento: true,
              ativo: true,
            });
            listaAtual.push(novaUnidade);
          }

          // Obra pai vira nó agrupador
          await erpRepository.updateCentroCusto(novoCC.id, { aceitaLancamento: false });
        }
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
          /* nível é cosmético na árvore */
        }
      }
    }

    const ehNaoAlocado = (pai?.codigo || '').replace(/\D/g, '') === '999';
    if (pai && pai.aceitaLancamento && !ehNaoAlocado) {
      try {
        await erpRepository.updateCentroCusto(pai.id, { aceitaLancamento: false });
      } catch {
        alert('O registro foi salvo, mas não foi possível marcar o pai como agrupador.');
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
      case 'centro_custo':
      case 'administrativo':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/80 flex items-center gap-1 uppercase">
            🏢 Centro de Custo
          </span>
        );
      case 'obra':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center gap-1 uppercase">
            🏗️ Apenas Obra
          </span>
        );
      case 'centro_custo_obra':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1 uppercase font-extrabold shadow-xs">
            🌟 Centro de Custo & Obra
          </span>
        );
      case 'frota':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200/80 flex items-center gap-1 uppercase">
            🚚 Frota
          </span>
        );
      case 'comercial':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center gap-1 uppercase">
            📈 Comercial
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 uppercase">
            {tipo}
          </span>
        );
    }
  };

  const treeNodes: TreeNode[] = centrosAtivos
    .filter((cc) => {
      if (filtroTipo === 'todos') return true;
      if (filtroTipo === 'centro_custo') {
        return cc.tipo === 'centro_custo' || cc.tipo === 'administrativo' || cc.tipo === 'frota' || cc.tipo === 'comercial';
      }
      if (filtroTipo === 'obra') return cc.tipo === 'obra';
      if (filtroTipo === 'centro_custo_obra') return cc.tipo === 'centro_custo_obra';
      return true;
    })
    .filter((cc) => {
      if (!searchTerm) return true;
      return cc.nome.toLowerCase().includes(searchTerm.toLowerCase()) || cc.codigo.includes(searchTerm);
    })
    .map((cc) => {
      const linhaVinculada = linhasGestao.find((l) => (cc.linhasGestaoIds ?? []).includes(l.id));

      return {
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
          <div className="flex items-center gap-1.5 flex-wrap">
            {cc.subempresaNome && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-purple-700" />
                {cc.subempresaNome}
              </span>
            )}
            {linhaVinculada && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/80 flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-600" />
                Linha: {linhaVinculada.codigo} - {linhaVinculada.nome}
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
        ) : undefined,
      };
    });

  const handleExecutarGeracaoPadrao = async () => {
    if (!obraIdGerarPadrao) return;
    const obra = centrosTodos.find((c) => c.id === obraIdGerarPadrao);
    if (!obra) return;

    setGerandoPadrao(true);
    const unidadesPadrao = UNIDADES_PADRAO_OBRA;

    try {
      let listaAtual = [...centrosTodos];
      for (const nomeUnidade of unidadesPadrao) {
        const jaExiste = listaAtual.some(
          (c) => c.parentId === obra.id && c.nome.toLowerCase() === nomeUnidade.toLowerCase()
        );
        if (!jaExiste) {
          const cod = proximoCodigo(listaAtual, { id: obra.id, codigo: obra.codigo, nivel: obra.nivel } as any);
          const nova = await erpRepository.createCentroCusto({
            codigo: cod,
            nome: nomeUnidade,
            parentId: obra.id,
            tipo: 'obra',
            nivel: obra.nivel + 1,
            aceitaLancamento: true,
            ativo: true,
          });
          listaAtual.push(nova);
        }
      }

      if (obra.aceitaLancamento) {
        await erpRepository.updateCentroCusto(obra.id, { aceitaLancamento: false });
      }

      setModalGerarPadraoOpen(false);
      await loadData();
      alert(`Unidades construtivas padrão geradas com sucesso para a obra ${obra.nome}!`);
    } catch (err: any) {
      alert(err.message || 'Erro ao gerar unidades padrão.');
    }
    setGerandoPadrao(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">Centro de Custos & Obras</h1>
          <p className="text-xs text-ink-muted mt-1">
            Cadastre entidades como <strong>Apenas Centro de Custo</strong>, <strong>Apenas Obra</strong> ou <strong>Centro de Custo e Obra</strong> (híbrido).
            Obras se ramificam em Unidades Construtivas (como <strong>IMPOSTOS</strong>, <strong>ENGENHARIA</strong>,{' '}
            <strong>MÃO DE OBRA</strong>, <strong>MATERIAIS</strong> e <strong>TORRES</strong>) para amarração na aba <strong>Apropriação</strong> e orçamento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const raizes = centrosTodos.filter((c) => !c.parentId && c.ativo);
              if (raizes.length > 0) setObraIdGerarPadrao(raizes[0].id);
              setModalGerarPadraoOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-surface border border-black/10 hover:bg-black/5 text-ink-primary rounded-xl text-xs font-semibold shadow-soft transition-all active:scale-[0.98]"
            title="Gera automaticamente unidades de Impostos, Engenharia, Mão de Obra, Materiais..."
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Gerar Unidades Padrão</span>
          </button>
          <button
            onClick={() => handleOpenNewModal()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Centro de Custo / Obra</span>
          </button>
        </div>
      </div>

      {/* Busca, Filtro por Tipo e Ativos */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 w-full">
          <div className="relative flex-1 w-full sm:w-80">
            <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por código ou nome de centro de custos / obra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-black/[0.06] rounded-xl pl-10 pr-4 py-2 text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 shadow-soft"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="bg-surface border border-black/[0.06] rounded-xl px-3 py-2 text-xs font-semibold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand shadow-soft"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="centro_custo">🏢 Apenas Centro de Custo</option>
              <option value="obra">🏗️ Apenas Obras</option>
              <option value="centro_custo_obra">🌟 Centro de Custo & Obra</option>
            </select>
          </div>
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
          <div className="p-12 text-center text-ink-muted">Nenhum registro encontrado.</div>
        ) : (
          <TreeView
            nodes={treeNodes}
            rotuloFilho="Unidade Construtiva"
            onAddChild={handleOpenNewModal}
            onEdit={handleOpenEditModal}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Modal: Formulário de Centro de Custos */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm overflow-hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border border-black/10 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 shrink-0 bg-surface">
                <div>
                  <h3 className="text-base font-bold text-ink-primary">
                    {editingId ? `Editar ${rotuloRegistro}` : `${ehLinha ? 'Nova' : 'Novo'} ${rotuloRegistro}`}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {ehLinha ? 'Defina os detalhes da Unidade Construtiva' : 'Defina a finalidade e os dados do registro'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-black/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {/* Classificação / Finalidade (Opção de ser Centro de Custo, Obra ou Ambos) */}
                  {!ehLinha && (
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-2">
                        Finalidade do Registro *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* 1. Apenas Centro de Custo */}
                        <button
                          type="button"
                          onClick={() => setFormTipo('centro_custo')}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                            formTipo === 'centro_custo' || formTipo === 'administrativo' || formTipo === 'frota' || formTipo === 'comercial'
                              ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'bg-white border-black/10 hover:bg-black/[0.02]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-base">🏢</span>
                            {(formTipo === 'centro_custo' || formTipo === 'administrativo' || formTipo === 'frota' || formTipo === 'comercial') && (
                              <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-ink-primary">Apenas Centro de Custo</h4>
                            <p className="text-[10px] text-ink-muted mt-0.5 leading-snug">
                              Administrativo, frota, comercial e departamentos sem canteiro de obras.
                            </p>
                          </div>
                        </button>

                        {/* 2. Apenas Obra */}
                        <button
                          type="button"
                          onClick={() => setFormTipo('obra')}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                            formTipo === 'obra'
                              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                              : 'bg-white border-black/10 hover:bg-black/[0.02]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-base">🏗️</span>
                            {formTipo === 'obra' && (
                              <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-ink-primary">Apenas Obra</h4>
                            <p className="text-[10px] text-ink-muted mt-0.5 leading-snug">
                              Projetos, construções, reformas e empreendimentos com unidades construtivas.
                            </p>
                          </div>
                        </button>

                        {/* 3. Centro de Custo e Obra */}
                        <button
                          type="button"
                          onClick={() => setFormTipo('centro_custo_obra')}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                            formTipo === 'centro_custo_obra'
                              ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-500/20 shadow-xs'
                              : 'bg-white border-black/10 hover:bg-black/[0.02]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-base">🌟</span>
                            {formTipo === 'centro_custo_obra' && (
                              <Check className="w-3.5 h-3.5 text-purple-600 stroke-[3]" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-ink-primary">Centro de Custo & Obra</h4>
                            <p className="text-[10px] text-ink-muted mt-0.5 leading-snug">
                              Híbrido: opera como obra física e também como centro de custo financeiro autônomo.
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Banner de Unidades Padrão Automáticas para Obras vs Centros de Custo Livres */}
                  {!ehLinha && !editingId && (formTipo === 'obra' || formTipo === 'centro_custo_obra') && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          Unidades Construtivas Padrão da Obra
                        </span>
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formAutoGerarUnidades}
                            onChange={(e) => setFormAutoGerarUnidades(e.target.checked)}
                            className="rounded border-amber-400 text-brand focus:ring-brand w-3.5 h-3.5"
                          />
                          <span>Criar automaticamente</span>
                        </label>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Como este registro é uma <strong>Obra</strong>, as 5 unidades construtivas fundamentais serão geradas automaticamente como nós-folha para apropriação e rateio orçamentário:
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {UNIDADES_PADRAO_OBRA.map((u) => (
                          <span
                            key={u}
                            className="text-[10px] font-bold bg-white text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-1"
                          >
                            <Check className="w-3 h-3 text-amber-600 stroke-[3]" />
                            {u}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!ehLinha && (formTipo === 'centro_custo' || formTipo === 'administrativo' || formTipo === 'frota' || formTipo === 'comercial') && (
                    <div className="bg-indigo-50/70 border border-indigo-200/60 rounded-xl p-3 text-[11px] text-indigo-900 leading-relaxed">
                      🏢 <strong>Apenas Centro de Custo:</strong> Cadastro corporativo livre. Não gera unidades construtivas automaticamente — você tem total liberdade para criar departamentos ou ramificações conforme sua necessidade.
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">
                      {ehLinha ? 'Obra / Centro de Custo Pai' : 'Vínculo Hierárquico (Pai Opcional)'}
                    </label>
                    <select
                      value={formParentId}
                      onChange={(e) => {
                        const novoPaiId = e.target.value;
                        const novoPai = centrosTodos.find((c) => c.id === novoPaiId) || null;
                        setFormParentId(novoPaiId);
                        setFormCodigo(proximoCodigo(centrosTodos.filter((c) => c.id !== editingId), novoPai));

                        if (novoPaiId) {
                          const linhaPai = getLinhaVinculadaDoCentroOuAncestrais(novoPaiId);
                          if (linhaPai) {
                            setFormGrupoGestaoId(linhaPai.grupoGestaoId);
                            setFormLinhaGestaoId(linhaPai.id);
                          }
                        }
                      }}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="">Nenhum (Nó Raiz)</option>
                      {centrosTodos
                        .filter(
                          (cc) =>
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
                        ? 'Este registro será uma Unidade Construtiva subordinada ao nó pai selecionado.'
                        : 'Sem vínculo pai, o registro fica no topo da hierarquia como nó principal.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <option value="centro_custo_obra">🌟 Centro de Custo & Obra (Ambos)</option>
                        <option value="centro_custo">🏢 Apenas Centro de Custo</option>
                        <option value="obra">🏗️ Apenas Obra / Projeto</option>
                        <option value="administrativo">Administrativo</option>
                        <option value="frota">Frota & Equipamentos</option>
                        <option value="comercial">Comercial</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-ink-muted">
                        Nome d{ehLinha ? 'a' : 'o'} {rotuloRegistro} *
                      </label>
                      {ehLinha && (
                        <span className="text-[10px] text-ink-muted font-medium">Sugestões rápidas:</span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={ehLinha ? 'Ex: MÃO DE OBRA, ENGENHARIA, IMPOSTOS...' : 'Ex: Residencial Villa Alpina'}
                      value={formNome}
                      onChange={(e) => setFormNome(e.target.value)}
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand font-medium"
                    />
                    {ehLinha && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          'MÃO DE OBRA',
                          'IMPOSTOS',
                          'ENGENHARIA',
                          'ADMINISTRATIVO',
                          'DIRETORIA',
                          'TORRE 1',
                          'ÁREA COMUM',
                          'MATERIAIS',
                          'INFRAESTRUTURA',
                        ].map((sugestao) => (
                          <button
                            key={sugestao}
                            type="button"
                            onClick={() => setFormNome(sugestao)}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold transition-all ${
                              formNome === sugestao
                                ? 'bg-brand text-white border-brand shadow-xs'
                                : 'bg-white hover:bg-brand/10 hover:text-brand text-ink-muted border-black/10'
                            }`}
                          >
                            + {sugestao}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vigência / Datas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      Ao ganhar a primeira Unidade Construtiva, a Obra vira agrupadora e deixa de
                      aceitar rateio direto — o custo passa a ser lançado nas Linhas.
                    </p>
                  </div>

                  {/* Vínculo com Gestão (Alocação & Orçamento) */}
                  <div className="bg-surface-muted p-3.5 rounded-xl border border-black/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-ink-primary flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-brand" />
                        <span>Linha de Gestão Vinculada</span>
                      </label>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold flex items-center gap-1 ${
                          ehLinha
                            ? 'bg-purple-50 text-purple-700 border-purple-200/80'
                            : 'bg-white text-ink-muted border-black/5'
                        }`}
                      >
                        {ehLinha ? '✨ Herdada da Obra' : 'Alocação & Apropriação'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                          Grupo de Gestão {ehLinha && <span className="text-[10px] text-purple-600 font-normal">(da Obra)</span>}
                        </label>
                        <select
                          value={formGrupoGestaoId}
                          onChange={(e) => {
                            setFormGrupoGestaoId(e.target.value);
                            setFormLinhaGestaoId('');
                          }}
                          className="w-full bg-white border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                        >
                          <option value="">Selecione o Grupo...</option>
                          {gruposGestao
                            .filter((g) => g.ativo)
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.codigo} - {g.nome}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                          Linha de Gestão {ehLinha && <span className="text-[10px] text-purple-600 font-normal">(da Obra)</span>}
                        </label>
                        <select
                          value={formLinhaGestaoId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setFormLinhaGestaoId(id);
                            // Escolher no combo ADICIONA à lista; a remoção é pelo X.
                            if (id && !formLinhasIds.includes(id)) {
                              setFormLinhasIds((prev) => [...prev, id]);
                            }
                          }}
                          disabled={!formGrupoGestaoId || formEscopoGlobal || ehLinha}
                          className="w-full bg-white border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {formGrupoGestaoId ? 'Adicionar Linha...' : 'Escolha um Grupo antes'}
                          </option>
                          {linhasGestao
                            .filter((l) => l.ativo && l.grupoGestaoId === formGrupoGestaoId)
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.codigo} - {l.nome}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Alcance do Grupo Macro: global ou as linhas escolhidas. */}
                    {!ehLinha && (
                      <div className="space-y-2">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formEscopoGlobal}
                            onChange={(e) => setFormEscopoGlobal(e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                          />
                          <span className="text-[11px] text-ink-primary leading-relaxed">
                            <strong>Grupo Macro global</strong> — as obras dele aparecem na
                            Apropriação junto com as de qualquer Linha de Gestão alocada, sem ficar
                            preso a uma linha só.
                          </span>
                        </label>

                        {!formEscopoGlobal && formLinhasIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {formLinhasIds.map((id) => {
                              const l = linhasGestao.find((x) => x.id === id);
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand"
                                >
                                  {l ? `${l.codigo} - ${l.nome}` : id}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFormLinhasIds((prev) => prev.filter((x) => x !== id))
                                    }
                                    title="Remover esta linha"
                                    className="text-brand/60 hover:text-brand"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-[11px] text-ink-muted leading-relaxed">
                      {ehLinha
                        ? 'Esta Unidade Construtiva herda o alcance da Obra principal — o vínculo com as Linhas de Gestão é cadastrado na Obra, não aqui.'
                        : formEscopoGlobal
                          ? 'Como Grupo Macro global, as obras deste centro de custo ficam disponíveis para Apropriação sempre que QUALQUER Linha de Gestão for alocada no título.'
                          : formLinhasIds.length === 0
                            ? 'Sem linha escolhida e sem ser global, as obras deste centro de custo não aparecem na Apropriação de nenhum título.'
                            : 'As obras deste centro de custo aparecem na Apropriação quando uma destas Linhas de Gestão for alocada no título.'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-3.5 border-t border-black/5 bg-surface-muted/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98] transition-all"
                  >
                    Salvar {rotuloRegistro}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal: Gerar Unidades Padrão */}
        {modalGerarPadraoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm overflow-hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-black/10 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 shrink-0 bg-surface">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink-primary">Gerar Unidades Construtivas Padrão</h3>
                    <p className="text-xs text-ink-muted">Criação rápida das macro-etapas e unidades da obra</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalGerarPadraoOpen(false)}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-black/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Selecione a Obra de Destino *</label>
                  <select
                    value={obraIdGerarPadrao}
                    onChange={(e) => setObraIdGerarPadrao(e.target.value)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2.5 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Selecione uma Obra...</option>
                    {centrosTodos
                      .filter((c) => !c.parentId && c.ativo && (c.tipo === 'obra' || c.tipo === 'centro_custo_obra'))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} - {c.nome}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="bg-surface-muted p-4 rounded-xl border border-black/5 space-y-2">
                  <span className="text-xs font-bold text-ink-primary block mb-2">As 5 unidades construtivas padrão que serão geradas:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { nome: 'MÃO DE OBRA', desc: 'Folha, Empreiteiros, Equipe de Obra' },
                      { nome: 'IMPOSTOS', desc: 'ISS, INSS, Alvarás, Taxas' },
                      { nome: 'ENGENHARIA', desc: 'Projetos, Laudos, RT, Topografia' },
                      { nome: 'ADMINISTRATIVO', desc: 'Gestão local, canteiro, logística' },
                      { nome: 'DIRETORIA', desc: 'Supervisão executiva do empreendimento' },
                    ].map((u) => (
                      <div key={u.nome} className="bg-white p-2.5 rounded-lg border border-black/5 flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-ink-primary text-[11px]">{u.nome}</p>
                          <p className="text-[10px] text-ink-muted">{u.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-3.5 border-t border-black/5 bg-surface-muted/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalGerarPadraoOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecutarGeracaoPadrao}
                  disabled={!obraIdGerarPadrao || gerandoPadrao}
                  className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{gerandoPadrao ? 'Gerando...' : 'Gerar Unidades Padrão'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
