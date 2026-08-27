'use client';

import { useEffect, useState } from 'react';
import { erpRepository, CentroCusto, TipoCentroCusto, Subempresa, GrupoGestao, LinhaGestao } from '@/data';
import { TreeView, TreeNode } from '@/components/TreeView';
import { Search, Plus, X, PieChart, Calendar, Building2, Layers, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { proximoCodigo } from '@/lib/codigos';
import { descendentesDe, recalcularNiveis } from '@/lib/arvore';

export default function CentroCustosPage() {
  const [centrosAtivos, setCentrosAtivos] = useState<CentroCusto[]>([]);
  const [gruposGestao, setGruposGestao] = useState<GrupoGestao[]>([]);
  const [linhasGestao, setLinhasGestao] = useState<LinhaGestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [apenasAtivos, setApenasAtivos] = useState(true);

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
  const [formTipo, setFormTipo] = useState<TipoCentroCusto>('obra');
  const [formGrupoGestaoId, setFormGrupoGestaoId] = useState<string>('');
  const [formLinhaGestaoId, setFormLinhaGestaoId] = useState<string>('');
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
    setFormGrupoGestaoId('');
    setFormLinhaGestaoId('');
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

    // Busca linha de gestão vinculada a este centro de custo
    const linhaVinculada = linhasGestao.find((l) => l.centroCustoId === item.id);
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
   * Vocabulário da tela: o nó de topo é a "Obra" e tudo que pendura abaixo dele
   * é uma "Unidade Construtiva". São exatamente os nomes das duas primeiras
   * colunas da aba Apropriação do título — mesma árvore, mesmo cadastro.
   *
   * "Obra" cobre também frota, administrativo e comercial, que são centros de
   * custo sem obra física; por isso o rótulo de topo cita os dois nomes.
   *
   * É o vínculo selecionado que define qual dos dois está sendo cadastrado — por
   * isso deriva do formulário, e não do registro carregado: trocar o vínculo no
   * modal já troca os rótulos.
   */
  const ehLinha = formParentId !== '';
  const rotuloRegistro = ehLinha ? 'Unidade Construtiva' : 'Obra / Centro de Custo';

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
      alert('Não foi possível identificar a Obra desta unidade construtiva. Recarregue a tela e tente de novo.');
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

    let centroCustoSalvoId = editingId;

    try {
      if (editingId) {
        await erpRepository.updateCentroCusto(editingId, payload);
      } else {
        const novoCC = await erpRepository.createCentroCusto(payload);
        centroCustoSalvoId = novoCC.id;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível salvar o centro de custo.');
      return;
    }

    // Sincroniza o vínculo com a Linha de Gestão
    if (centroCustoSalvoId) {
      const linhaAnterior = linhasGestao.find((l) => l.centroCustoId === centroCustoSalvoId);

      if (formLinhaGestaoId) {
        // Se mudou de linha de gestão, desvincula a linha anterior
        if (linhaAnterior && linhaAnterior.id !== formLinhaGestaoId) {
          try {
            await erpRepository.updateLinhaGestao(linhaAnterior.id, { centroCustoId: undefined });
          } catch (e) {
            console.warn('Erro ao desvincular linha anterior:', e);
          }
        }
        // Vincula a nova linha de gestão
        try {
          await erpRepository.updateLinhaGestao(formLinhaGestaoId, { centroCustoId: centroCustoSalvoId });
        } catch (e) {
          console.warn('Erro ao vincular linha de gestão:', e);
        }
      } else if (linhaAnterior) {
        // Usuário removeu o vínculo
        try {
          await erpRepository.updateLinhaGestao(linhaAnterior.id, { centroCustoId: undefined });
        } catch (e) {
          console.warn('Erro ao desvincular linha de gestão:', e);
        }
      }
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
        alert('A unidade construtiva foi salva, mas não foi possível marcar a Obra como agrupadora. Ajuste manualmente.');
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
    .map((cc) => {
      const linhaVinculada = linhasGestao.find((l) => l.centroCustoId === cc.id);

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
    const unidadesPadrao = [
      'IMPOSTOS & TAXAS',
      'ENGENHARIA & PROJETOS',
      'MÃO DE OBRA',
      'MATERIAIS DE CONSTRUÇÃO',
      'ADMINISTRAÇÃO DA OBRA',
      'TORRE 1 / OPERAÇÃO',
    ];

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
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">Centro de Custos (Obras & Projetos)</h1>
          <p className="text-xs text-ink-muted mt-1">
            Cada Obra se ramifica em Unidades Construtivas (como <strong>IMPOSTOS</strong>, <strong>ENGENHARIA</strong>,{' '}
            <strong>MÃO DE OBRA</strong>, <strong>MATERIAIS</strong> e <strong>TORRES</strong>). São estes os nomes que a aba{' '}
            <strong>Apropriação</strong> do título usa nas duas primeiras colunas, e é aqui que o
            orçamento da obra encontra as unidades para distribuir os itens.
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
            <span>Nova Obra</span>
          </button>
        </div>
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
          <div className="p-12 text-center text-ink-muted">Nenhuma obra encontrada.</div>
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
                    {ehLinha ? 'Defina os detalhes da Unidade Construtiva' : 'Defina os dados da Obra / Centro de Custo'}
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
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Obra</label>
                    <select
                      value={formParentId}
                      onChange={(e) => {
                        const novoPai = centrosTodos.find((c) => c.id === e.target.value) || null;
                        setFormParentId(e.target.value);
                        setFormCodigo(proximoCodigo(centrosTodos.filter((c) => c.id !== editingId), novoPai));
                      }}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="">Nenhum — cadastrar uma Obra</option>
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
                        ? 'Este registro será uma Unidade Construtiva da Obra selecionada.'
                        : 'Sem vínculo, o registro é uma Obra — as Unidades Construtivas são cadastradas dentro dela.'}
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
                        <option value="obra">Obra / Projeto</option>
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
                          'IMPOSTOS',
                          'ENGENHARIA',
                          'MÃO DE OBRA',
                          'MATERIAIS',
                          'ADMINISTRAÇÃO DA OBRA',
                          'MÁQUINAS & EQUIPAMENTOS',
                          'TORRE 1',
                          'ÁREA COMUM',
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
                      <span className="text-[10px] text-ink-muted bg-white px-2 py-0.5 rounded-md border border-black/5 font-medium">
                        Alocação & Apropriação
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1">Grupo de Gestão</label>
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
                        <label className="block text-[11px] font-semibold text-ink-muted mb-1">Linha de Gestão</label>
                        <select
                          value={formLinhaGestaoId}
                          onChange={(e) => setFormLinhaGestaoId(e.target.value)}
                          disabled={!formGrupoGestaoId}
                          className="w-full bg-white border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {formGrupoGestaoId ? 'Selecione a Linha...' : 'Escolha um Grupo antes'}
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

                    <p className="text-[11px] text-ink-muted leading-relaxed">
                      Vincular este Centro de Custo a uma Linha de Gestão permite que, ao selecionar a Linha na{' '}
                      <strong>Alocação de Gestão</strong> do título, esta Obra, suas Unidades Construtivas e Itens de Orçamento
                      fiquem disponíveis para <strong>Apropriação</strong>.
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
                      .filter((c) => !c.parentId && c.ativo)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} - {c.nome}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="bg-surface-muted p-4 rounded-xl border border-black/5 space-y-2">
                  <span className="text-xs font-bold text-ink-primary block mb-2">Unidades que serão criadas com 1 clique:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { nome: 'IMPOSTOS & TAXAS', desc: 'ISS, INSS, Alvarás, Taxas' },
                      { nome: 'ENGENHARIA & PROJETOS', desc: 'Projetos, Laudos, RT, Topografia' },
                      { nome: 'MÃO DE OBRA', desc: 'Folha, Empreiteiros, CLT' },
                      { nome: 'MATERIAIS DE CONSTRUÇÃO', desc: 'Insumos, Concreto, Aço' },
                      { nome: 'ADMINISTRAÇÃO DA OBRA', desc: 'Canteiro, Água, Luz, Segurança' },
                      { nome: 'TORRE 1 / OPERAÇÃO', desc: 'Unidade física construtiva' },
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
