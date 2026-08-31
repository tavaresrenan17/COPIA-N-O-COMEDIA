'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  erpRepository, 
  CentroCusto, 
  Orcamento, 
  PlanoConta,
  LinhaGestao,
  ExclusaoOrcamentoPrevia
} from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { OrcamentoSpreadsheetEditor } from '@/components/OrcamentoSpreadsheetEditor';
import { ImportExcelOrcamentoModal } from '@/components/ImportExcelOrcamentoModal';
import { AcompanhamentoOrcamentarioView } from '@/components/AcompanhamentoOrcamentarioView';
import { 
  PieChart, 
  Plus, 
  Copy, 
  Lock, 
  X, 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Building2, 
  Edit3, 
  Eye,
  AlertCircle,
  TrendingUp,
  Table,
  Trash2,
  Unlock,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/ToastProvider';

function OrcamentosPage() {
  const toast = useToast();

  // Navegação por Abas
  const [activeTab, setActiveTab] = useState<'matriz' | 'acompanhamento'>('matriz');

  // Estado Principal
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [linhasGestao, setLinhasGestao] = useState<LinhaGestao[]>([]);
  const [planosNivel2, setPlanosNivel2] = useState<PlanoConta[]>([]);
  const [loading, setLoading] = useState(true);


  // Filtros da Listagem
  const [filtroCcId, setFiltroCcId] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modo Editor de Planilha (Quando seleciona um orçamento para editar ou visualizar)
  const [activeOrcamento, setActiveOrcamento] = useState<Orcamento | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Modais Auxiliares
  const [modalNovoOpen, setModalNovoOpen] = useState(false);
  const [modalImportOpen, setModalImportOpen] = useState(false);
  const [modalRevisaoOpen, setModalRevisaoOpen] = useState<Orcamento | null>(null);
  /*
   * Orçamento aprovado nasce congelado. Este id é o único que a planilha aceita
   * editar, e ele só é preenchido depois de o usuário confirmar o aviso — assim
   * a edição de uma base já aprovada é sempre um ato deliberado, nunca um
   * clique distraído. Volta a null ao fechar o editor.
   */
  const [edicaoLiberadaId, setEdicaoLiberadaId] = useState<string | null>(null);
  const [modalEdicaoOpen, setModalEdicaoOpen] = useState<Orcamento | null>(null);
  /** Orçamento em vias de ser excluído, junto com o que a exclusão leva. */
  const [modalExcluirOpen, setModalExcluirOpen] = useState<{ orc: Orcamento; previa: ExclusaoOrcamentoPrevia } | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  /** Sequência das prévias em voo — só a última pode abrir o modal. */
  const exclusaoReqRef = useRef(0);
  const [verificandoExclusaoId, setVerificandoExclusaoId] = useState<string | null>(null);

  // Form Novo Orçamento
  const [formCcId, setFormCcId] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formDataInicio, setFormDataInicio] = useState('2026-01-01');
  const [formDataFim, setFormDataFim] = useState('2026-12-31');
  const [formObservacao, setFormObservacao] = useState('');

  // Form Revisão
  const [formMotivoRevisao, setFormMotivoRevisao] = useState('');

  useEffect(() => {
    loadAuxiliaryData();
  }, []);

  useEffect(() => {
    loadOrcamentosList();
  }, [filtroCcId, filtroStatus]);

  /**
   * Obras: os nós de topo da árvore de centro de custo. Orçamento é da OBRA —
   * uma unidade construtiva não tem orçamento próprio, tem itens dentro do
   * orçamento da obra.
   */
  const obras = centrosCusto.filter(cc => !cc.parentId);

  /** Unidades Construtivas da obra do orçamento aberto no editor. */
  const unidadesDaObraAtiva = activeOrcamento
    ? centrosCusto.filter(cc => cc.parentId === activeOrcamento.centroCustoId)
    : [];

  async function loadAuxiliaryData() {
    const [ccs, pcs, lgs] = await Promise.all([
      erpRepository.getCentrosCusto({ apenasAtivos: true }),
      erpRepository.getPlanoContas({ apenasAtivos: true }),
      erpRepository.getLinhasGestao(undefined, { apenasAtivos: true })
    ]);

    setCentrosCusto(ccs);
    setLinhasGestao(lgs);
    const n2 = pcs.filter(p => p.nivel === 2 || (p.codigo.split('.').length === 2 && !p.aceitaLancamento));
    setPlanosNivel2(n2.length > 0 ? n2 : pcs.filter(p => p.nivel === 2));

    const raizes = ccs.filter(cc => !cc.parentId);
    if (raizes.length > 0) setFormCcId(raizes[0].id);
  }

  async function loadOrcamentosList() {
    setLoading(true);
    const list = await erpRepository.getOrcamentos({
      centroCustoId: filtroCcId || undefined,
      status: filtroStatus || undefined
    });
    setOrcamentos(list);
    setLoading(false);
  }

  // Ações de Estado
  async function handleAprovarOrcamento(orc: Orcamento) {
    if (!confirm(`Deseja aprovar e congelar o orçamento "${orc.nome}" (v${orc.versao})? Nenhum item poderá ser alterado após a aprovação.`)) return;
    await erpRepository.aprovarOrcamento(orc.id);
    await loadOrcamentosList();
    if (activeOrcamento?.id === orc.id) {
      const updated = await erpRepository.getOrcamentoById(orc.id);
      if (updated) setActiveOrcamento(updated);
    }
  }

  /**
   * Abre a confirmação de edição de um orçamento aprovado.
   *
   * Aprovar congela a planilha de propósito: o acompanhamento compara o
   * realizado contra ela. Editar continua sendo possível — é o que resolve
   * item cadastrado com plano de contas errado —, mas passa por um aviso que
   * diz o que muda, em vez de simplesmente destravar o campo.
   */
  function pedirLiberacaoEdicao(orc: Orcamento) {
    setModalEdicaoOpen(orc);
  }

  function confirmarLiberacaoEdicao() {
    if (!modalEdicaoOpen) return;
    setEdicaoLiberadaId(modalEdicaoOpen.id);
    setModalEdicaoOpen(null);
  }

  /** Fecha o editor e volta a trancar o que estava aprovado. */
  function fecharEditor() {
    setIsEditing(false);
    setActiveOrcamento(null);
    setEdicaoLiberadaId(null);
  }

  /**
   * Abre a confirmação de exclusão com a prévia carregada.
   *
   * A prévia leva vários round-trips. Sem o contador, clicar na lixeira de duas
   * planilhas em sequência deixava a resposta mais lenta chegar por último e
   * abrir o modal da planilha errada — numa tela cujo botão seguinte apaga
   * dados. Só a última solicitação pode abrir o modal.
   */
  async function pedirExclusao(orc: Orcamento) {
    const requisicao = ++exclusaoReqRef.current;
    setVerificandoExclusaoId(orc.id);
    try {
      const previa = await erpRepository.previaExclusaoOrcamento(orc.id);
      if (requisicao !== exclusaoReqRef.current) return;   // chegou tarde: descarta
      setModalExcluirOpen({ orc, previa });
    } catch (err) {
      if (requisicao !== exclusaoReqRef.current) return;
      toast.error('Não foi possível verificar o orçamento', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      if (requisicao === exclusaoReqRef.current) setVerificandoExclusaoId(null);
    }
  }

  async function confirmarExclusao() {
    if (!modalExcluirOpen || excluindo) return;
    setExcluindo(true);
    try {
      await erpRepository.deleteOrcamento(modalExcluirOpen.orc.id);
      toast.success(`Orçamento "${modalExcluirOpen.orc.nome}" excluído.`);
      // O editor pode estar aberto justamente na planilha que sumiu.
      if (activeOrcamento?.id === modalExcluirOpen.orc.id) fecharEditor();
      setModalExcluirOpen(null);
      await loadOrcamentosList();
    } catch (err) {
      toast.error('Não foi possível excluir', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setExcluindo(false);
    }
  }

  async function handleCriarRevisaoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modalRevisaoOpen) return;
    if (!formMotivoRevisao.trim()) {
      alert('O motivo da revisão é obrigatório.');
      return;
    }

    try {
      const novaRevisao = await erpRepository.criarRevisaoOrcamento(modalRevisaoOpen.id, formMotivoRevisao);
      setModalRevisaoOpen(null);
      setFormMotivoRevisao('');
      await loadOrcamentosList();
      // Abre o editor na nova versão rascunho
      setActiveOrcamento(novaRevisao);
      setIsEditing(true);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar revisão.');
    }
  }

  async function handleCreateNovoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formCcId || !formNome) return;

    try {
      /*
       * Nasce sem itens. Antes vinha com um "Item Inicial Planejado" de
       * R$ 12.000,00 — inofensivo enquanto o módulo era mock, mas agora o
       * orçamento é gravado no banco e esse item apareceria como opção real no
       * combo Item Orçamento da aba Apropriação do título.
       *
       * O editor abre com uma linha em branco logo em seguida, então não há
       * perda de comodidade.
       */
      const novo = await erpRepository.createOrcamento({
        centroCustoId: formCcId,
        nome: formNome,
        dataInicio: formDataInicio,
        dataFim: formDataFim,
        observacao: formObservacao,
        itens: []
      });

      setModalNovoOpen(false);
      setFormNome('');
      setFormObservacao('');
      await loadOrcamentosList();
      
      // Abre a planilha para edição imediata
      setActiveOrcamento(novo);
      setIsEditing(true);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar orçamento.');
    }
  }

  async function handleSaveSpreadsheetItens(itensPayload: any[]) {
    if (!activeOrcamento) return;
    try {
      const updated = await erpRepository.updateOrcamento(activeOrcamento.id, {
        itens: itensPayload
      });
      setActiveOrcamento(updated);
      await loadOrcamentosList();
      alert('Orçamento salvo com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar itens do orçamento.');
    }
  }

  function handleConfirmImportExcel(itensValidados: any[]) {
    if (!activeOrcamento) return;
    
    // Converte os itens importados para o formato da planilha
    const novosItens = itensValidados.map(it => {
      const valorMensal = Math.round(it.valorTotalCentavos / 12);
      const periodos = [];
      for (let m = 1; m <= 12; m++) {
        const mm = m < 10 ? `0${m}` : `${m}`;
        periodos.push({
          mesReferencia: `2026-${mm}-01`,
          valorCentavos: valorMensal
        });
      }
      return {
        ...it,
        periodos
      };
    });

    handleSaveSpreadsheetItens([...(activeOrcamento.itens || []), ...novosItens]);
    setModalImportOpen(false);
  }

  function handleExportarExcel(orc: Orcamento) {
    let csv = `Obra;${orc.centroCustoNome}\n`;
    csv += `Orçamento;${orc.nome} (v${orc.versao})\n`;
    csv += `Status;${orc.status}\n`;
    csv += `Período;${orc.dataInicio} a ${orc.dataFim}\n\n`;

    csv += `Código;Unidade Construtiva;Item do Orçamento;Valor Esperado (R$)\n`;

    orc.itens?.forEach(it => {
      const vt = (it.valorTotalCentavos / 100).toFixed(2).replace('.', ',');
      const uc = it.centroCustoNome || 'Toda a obra';
      csv += `${it.codigo || ''};"${uc}";"${it.descricao || ''}";${vt}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orcamento_${orc.centroCustoCodigo}_v${orc.versao}.csv`;
    a.click();
  }

  const filteredOrcamentos = orcamentos.filter(o => {
    const st = searchTerm.toLowerCase();
    return (
      o.nome.toLowerCase().includes(st) ||
      o.centroCustoNome.toLowerCase().includes(st) ||
      o.centroCustoCodigo.toLowerCase().includes(st)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* SELETOR DE ABAS PRINCIPAIS */}
      {!isEditing && (
        <div className="flex items-center gap-2 bg-surface p-1.5 rounded-2xl shadow-soft border border-black/[0.04] w-fit">
          <button
            onClick={() => setActiveTab('matriz')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'matriz' 
                ? 'bg-brand text-white shadow-md' 
                : 'text-ink-muted hover:text-ink-primary hover:bg-black/5'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Planilha da Obra</span>
          </button>

          <button
            onClick={() => setActiveTab('acompanhamento')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'acompanhamento' 
                ? 'bg-brand text-white shadow-md' 
                : 'text-ink-muted hover:text-ink-primary hover:bg-black/5'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Acompanhamento &amp; Relatórios</span>
          </button>
        </div>
      )}

      {/* SEÇÃO DE ACOMPANHAMENTO & CURVA S */}
      {!isEditing && activeTab === 'acompanhamento' ? (
        <AcompanhamentoOrcamentarioView />
      ) : (
        <>
      {/* SEÇÃO DA PLANILHA ATIVA (SE ESTIVER EDITANDO/VISUALIZANDO UM ORÇAMENTO) */}
      {isEditing && activeOrcamento ? (

        <div className="space-y-4">
          <div className="flex items-center justify-between bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono bg-brand/10 text-brand px-2 py-0.5 rounded">
                  {activeOrcamento.centroCustoCodigo}
                </span>
                <span className="text-xs font-bold text-ink-muted uppercase">
                  {activeOrcamento.centroCustoNome}
                </span>
              </div>
              <h2 className="text-xl font-bold text-ink-primary mt-1">
                {activeOrcamento.nome} <span className="text-brand font-mono">v{activeOrcamento.versao}</span>
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Período: {activeOrcamento.dataInicio.split('-').reverse().join('/')} a {activeOrcamento.dataFim.split('-').reverse().join('/')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {activeOrcamento.status !== 'aprovado' && (
                <button
                  onClick={() => setModalImportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold border border-emerald-200 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Importar Excel</span>
                </button>
              )}

              <button
                onClick={() => handleExportarExcel(activeOrcamento)}
                className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-black/10 text-ink-primary hover:bg-black/5 rounded-xl text-xs font-bold shadow-soft transition-all"
              >
                <Download className="w-4 h-4 text-brand" />
                <span>Exportar Excel</span>
              </button>

              {activeOrcamento.status === 'aprovado' && edicaoLiberadaId !== activeOrcamento.id && (
                <button
                  onClick={() => pedirLiberacaoEdicao(activeOrcamento)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl text-xs font-bold border border-amber-200 transition-all"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Editar planilha aprovada</span>
                </button>
              )}

              <button
                onClick={fecharEditor}
                className="px-4 py-2 bg-black/5 text-ink-primary hover:bg-black/10 rounded-xl text-xs font-bold"
              >
                Fechar Editor
              </button>
            </div>
          </div>

          {activeOrcamento.status === 'aprovado' && edicaoLiberadaId === activeOrcamento.id && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <span className="font-bold block">Você está editando uma planilha aprovada.</span>
                O acompanhamento compara o realizado contra estes valores — alterar um item muda a base
                de comparação dos títulos já apropriados nele. Fechar o editor tranca a planilha de novo.
              </div>
            </div>
          )}

          {/* GRID TIPO PLANILHA */}
          <OrcamentoSpreadsheetEditor
            dataInicio={activeOrcamento.dataInicio}
            dataFim={activeOrcamento.dataFim}
            planosNivel2={planosNivel2}
            subCentrosCusto={unidadesDaObraAtiva}
            obraId={activeOrcamento.centroCustoId}
            obraNome={activeOrcamento.centroCustoNome}
            orcamentoId={activeOrcamento.id}
            initialItens={activeOrcamento.itens}
            isReadonly={activeOrcamento.status === 'aprovado' && edicaoLiberadaId !== activeOrcamento.id}
            onNovaUnidade={(nova) => setCentrosCusto(prev => [...prev, nova])}
            onSave={handleSaveSpreadsheetItens}
            onCancel={fecharEditor}
          />
        </div>
      ) : (
        /* MODO DE LISTAGEM DE ORÇAMENTOS */
        <>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
            <div>
              <div className="flex items-center gap-2 text-brand mb-1">
                <PieChart className="w-5 h-5 stroke-[2.5]" />
                <span className="text-xs font-bold uppercase tracking-wider">Planilha Orçamentária</span>
              </div>
              <h1 className="text-xl font-bold text-ink-primary tracking-tight">Orçamento de Obra</h1>
              <p className="text-xs text-ink-muted mt-0.5">
                Um orçamento por Obra. Cada item recebe um código, uma Unidade Construtiva e o
                Plano Financeiro — é este item que a aba Apropriação do título oferece.
              </p>
            </div>

            <button
              onClick={() => setModalNovoOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Orçamento</span>
            </button>
          </div>

          {/* CONTROLES E FILTROS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface p-4 rounded-2xl shadow-soft border border-black/[0.03]">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome do orçamento ou centro de custo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-muted border border-black/[0.06] rounded-xl pl-11 pr-4 py-2.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/40 transition-all"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-surface-muted px-3 py-2 rounded-xl border border-black/5">
                <Building2 className="w-4 h-4 text-ink-muted" />
                <select
                  value={filtroCcId}
                  onChange={(e) => setFiltroCcId(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-ink-primary focus:outline-none"
                >
                  <option value="">Todas as Obras</option>
                  {obras.map(cc => (
                    <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-surface-muted px-3 py-2 rounded-xl border border-black/5">
                <Filter className="w-4 h-4 text-ink-muted" />
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-ink-primary focus:outline-none"
                >
                  <option value="">Todos os Status</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="aprovado">Aprovado (Congelado)</option>
                  <option value="revisado">Revisado</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABELA DA LISTAGEM DE ORÇAMENTOS */}
          <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.03] overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-ink-muted animate-pulse">Carregando orçamentos...</div>
            ) : filteredOrcamentos.length === 0 ? (
              <div className="p-12 text-center text-ink-muted space-y-3">
                <PieChart className="w-10 h-10 text-ink-muted/40 mx-auto" />
                <p className="text-xs">Nenhum orçamento encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                      <th className="py-3 px-4">Obra</th>
                      <th className="py-3 px-4">Nome do Orçamento</th>
                      <th className="py-3 px-4 text-center">Versão</th>
                      <th className="py-3 px-4">Período</th>
                      <th className="py-3 px-4 text-right">Valor Total (Orçado)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">% Consumido</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 font-medium">
                    {filteredOrcamentos.map((orc) => (
                      <tr key={orc.id} className="hover:bg-black/[0.02] transition-colors">
                        <td className="py-4 px-4 font-bold">
                          <span className="font-mono text-brand block">{orc.centroCustoCodigo}</span>
                          <span className="text-ink-primary">{orc.centroCustoNome}</span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-bold text-ink-primary block">{orc.nome}</span>
                          {orc.motivoRevisao && (
                            <span className="text-[10px] text-amber-600 block mt-0.5">
                              Motivo Revisão: {orc.motivoRevisao}
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-black/5 text-ink-primary">
                            v{orc.versao}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-ink-muted">
                          {orc.dataInicio.split('-').reverse().join('/')} a {orc.dataFim.split('-').reverse().join('/')}
                        </td>

                        <td className="py-4 px-4 text-right font-mono font-bold text-brand text-sm">
                          {formatCurrency(orc.valorTotalCentavos)}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold ${
                            orc.status === 'aprovado' 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                              : orc.status === 'revisado' 
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            {orc.status === 'aprovado' ? '★ Aprovado' : orc.status.toUpperCase()}
                          </span>
                        </td>

                        {/* PLACEHOLDER PARA ETAPA 7 */}
                        <td className="py-4 px-4 text-center text-ink-muted font-mono font-semibold">
                          <span className="px-2 py-1 bg-black/5 rounded text-[11px]" title="Será calculado dinamicamente na Etapa 7">
                            -% (Etapa 7)
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {orc.status !== 'aprovado' ? (
                              <button
                                onClick={() => { setActiveOrcamento(orc); setIsEditing(true); }}
                                className="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-brand-hover transition-all flex items-center gap-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Editar Planilha</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => { setActiveOrcamento(orc); setIsEditing(true); }}
                                className="px-3 py-1.5 bg-surface border border-black/10 text-ink-primary hover:bg-black/5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5 text-brand" />
                                <span>Ver Planilha</span>
                              </button>
                            )}

                            {orc.status !== 'aprovado' && (
                              <button
                                onClick={() => handleAprovarOrcamento(orc)}
                                title="Aprovar e Congelar Orçamento"
                                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-all"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            )}

                            {orc.status === 'aprovado' && (
                              <button
                                onClick={() => { setModalRevisaoOpen(orc); setFormMotivoRevisao(''); }}
                                title="Criar Nova Revisão"
                                className="p-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg border border-purple-200 transition-all"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => pedirExclusao(orc)}
                              disabled={verificandoExclusaoId !== null}
                              title="Excluir orçamento"
                              className="p-1.5 bg-surface border border-black/10 text-ink-muted hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-40 disabled:hover:text-ink-muted rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleExportarExcel(orc)}
                              title="Exportar CSV/Excel"
                              className="p-1.5 bg-surface border border-black/10 text-ink-muted hover:text-ink-primary rounded-lg transition-all"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL: CRIAR NOVO ORÇAMENTO */}
      <AnimatePresence>
        {modalNovoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl border border-black/10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <h3 className="text-base font-bold text-ink-primary">Novo Orçamento de Empreendimento</h3>
                <button onClick={() => setModalNovoOpen(false)} className="text-ink-muted hover:text-ink-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateNovoSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Nome do Orçamento</label>
                  <input
                    type="text"
                    placeholder="Ex: Orçamento Executivo Villa Alpina 2026"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    required
                    autoFocus
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Centro de Custo</label>
                  <select
                    value={formCcId}
                    onChange={(e) => setFormCcId(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Selecione o Centro de Custo...</option>
                    {(obras.length > 0 ? obras : centrosCusto).map(cc => {
                      const lg = linhasGestao.find(l => (cc.linhasGestaoIds ?? []).includes(l.id));
                      return (
                        <option key={cc.id} value={cc.id}>
                          {cc.codigo} - {cc.nome}{lg ? ` (Linha: ${lg.codigo} - ${lg.nome})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Data Início</label>
                    <input
                      type="date"
                      value={formDataInicio}
                      onChange={(e) => setFormDataInicio(e.target.value)}
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Data Fim</label>
                    <input
                      type="date"
                      value={formDataFim}
                      onChange={(e) => setFormDataFim(e.target.value)}
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Observação / Justificativa</label>
                  <textarea
                    rows={2}
                    placeholder="Notas iniciais sobre a premissa orçamentária..."
                    value={formObservacao}
                    onChange={(e) => setFormObservacao(e.target.value)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalNovoOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md"
                  >
                    Abrir Planilha de Edição
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CRIAR REVISÃO DE ORÇAMENTO APROVADO */}
      <AnimatePresence>
        {modalRevisaoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl border border-black/10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink-primary">Criar Revisão de Orçamento</h3>
                  <p className="text-xs text-ink-muted">Gerar versão v{modalRevisaoOpen.versao + 1} a partir da versão congelada</p>
                </div>
                <button onClick={() => setModalRevisaoOpen(null)} className="text-ink-muted hover:text-ink-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCriarRevisaoSubmit} className="space-y-4">
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-800 space-y-1">
                  <span className="font-bold block">Duplicação Automática do Orçamento:</span>
                  <p>A versão aprovada v{modalRevisaoOpen.versao} será mantida intacta e mudará para o status <strong>'revisado'</strong>. A nova versão v{modalRevisaoOpen.versao + 1} nascerá como <strong>'rascunho'</strong> pronta para edições.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Motivo da Revisão (Obrigatório)</label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Reajuste do contrato de mão de obra e acréscimo de insumos de alvenaria..."
                    value={formMotivoRevisao}
                    onChange={(e) => setFormMotivoRevisao(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalRevisaoOpen(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-md"
                  >
                    Gerar Versão v{modalRevisaoOpen.versao + 1}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: LIBERAR EDIÇÃO DE ORÇAMENTO APROVADO */}
      <AnimatePresence>
        {modalEdicaoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl border border-black/10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink-primary">Editar planilha aprovada</h3>
                  <p className="text-xs text-ink-muted">{modalEdicaoOpen.nome}</p>
                </div>
                <button onClick={() => setModalEdicaoOpen(null)} className="text-ink-muted hover:text-ink-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <p>
                  Este orçamento foi aprovado e está congelado. O acompanhamento usa estes valores como base
                  para calcular consumo e estouro.
                </p>
                <p>
                  Editar altera essa base para os títulos que já foram apropriados aqui. Se a intenção é
                  registrar mudança de escopo preservando o histórico, use <strong>Nova Revisão</strong> no lugar.
                </p>
              </div>

              <p className="text-xs text-ink-muted">
                A planilha destrava só nesta sessão de edição. Ao fechar o editor, ela volta a ficar congelada.
              </p>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setModalEdicaoOpen(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarLiberacaoEdicao}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  Destravar para edição
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EXCLUIR ORÇAMENTO */}
      <AnimatePresence>
        {modalExcluirOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-black/10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div>
                  <h3 className="text-base font-bold text-ink-primary">
                    {modalExcluirOpen.previa.podeExcluir
                      ? 'Excluir orçamento'
                      : 'Este orçamento não pode ser excluído'}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {modalExcluirOpen.orc.centroCustoCodigo} · {modalExcluirOpen.previa.orcamentoNome}
                  </p>
                </div>
                <button onClick={() => setModalExcluirOpen(null)} className="text-ink-muted hover:text-ink-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalExcluirOpen.previa.podeExcluir ? (
                <>
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-2">
                    <span className="font-bold block">A exclusão é definitiva e não tem como desfazer.</span>
                    <p>
                      Vão junto <strong>{modalExcluirOpen.previa.itensCount} item(ns)</strong> da planilha e a
                      distribuição mensal deles, somando{' '}
                      <strong className="font-mono">
                        {formatCurrency(modalExcluirOpen.previa.valorTotalCentavos)}
                      </strong>{' '}
                      orçados.
                    </p>
                    <p>Nenhum título está apropriado nesta planilha, então nada de financeiro é afetado.</p>
                  </div>

                  <p className="text-xs text-ink-muted">
                    Se o objetivo é só tirar a planilha de circulação sem perdê-la, encerre o orçamento em vez
                    de excluir.
                  </p>

                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      onClick={() => setModalExcluirOpen(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarExclusao}
                      disabled={excluindo}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {modalExcluirOpen.previa.revisoesDependentes ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                      <span className="font-bold block">Esta planilha é a base de uma revisão.</span>
                      <p>
                        A revisão {modalExcluirOpen.previa.revisoesDependentes} aponta para este orçamento como
                        versão de origem. Exclua a revisão primeiro, ou encerre este orçamento — assim a
                        comparação entre as versões continua de pé.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                      <span className="font-bold block">
                        {modalExcluirOpen.previa.bloqueios.length} apropriação(ões) apontam para itens desta planilha.
                      </span>
                      <p>
                        Apagar levaria junto o vínculo de títulos já lançados. Retire a apropriação nos títulos
                        abaixo e tente de novo — ou encerre o orçamento, que o tira de circulação preservando o
                        histórico.
                      </p>
                    </div>
                  )}

                  <div
                    className="max-h-56 overflow-y-auto border border-black/10 rounded-xl"
                    hidden={modalExcluirOpen.previa.bloqueios.length === 0}
                  >
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-surface-muted">
                        <tr className="text-ink-muted font-bold">
                          <th className="p-2">Título</th>
                          <th className="p-2">Item apropriado</th>
                          <th className="p-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {modalExcluirOpen.previa.bloqueios.map((b, i) => (
                          <tr key={`${b.tituloId}-${i}`}>
                            <td className="p-2">
                              <span className="font-bold text-ink-primary block">{b.tituloCodigo}</span>
                              <span className="text-ink-muted">{b.tituloDescricao || '-'}</span>
                            </td>
                            <td className="p-2 text-ink-primary">{b.itemDescricao}</td>
                            <td className="p-2 text-right font-mono font-bold text-ink-primary">
                              {formatCurrency(b.valorRateadoCentavos)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => setModalExcluirOpen(null)}
                      className="px-5 py-2 bg-black/5 text-ink-primary hover:bg-black/10 rounded-xl text-xs font-semibold"
                    >
                      Entendi
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: IMPORTAÇÃO DE EXCEL */}
      {modalImportOpen && (
        <ImportExcelOrcamentoModal
          planosNivel2={planosNivel2}
          onConfirmImport={handleConfirmImportExcel}
          onClose={() => setModalImportOpen(false)}
        />
      )}
        </>
      )}
    </div>
  );

}

export default OrcamentosPage;
