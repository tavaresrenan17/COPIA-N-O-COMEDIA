'use client';

import React, { useEffect, useState } from 'react';
import { 
  erpRepository, 
  CentroCusto, 
  Orcamento, 
  PlanoConta 
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
  Table
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function OrcamentosPage() {
  // Navegação por Abas
  const [activeTab, setActiveTab] = useState<'matriz' | 'acompanhamento'>('matriz');

  // Estado Principal
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
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
    const [ccs, pcs] = await Promise.all([
      erpRepository.getCentrosCusto({ apenasAtivos: true }),
      erpRepository.getPlanoContas({ apenasAtivos: true })
    ]);

    setCentrosCusto(ccs);
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

    csv += `Código;Unidade Construtiva;Plano Financeiro (Nível 2);Descrição;Quantidade;Unidade;Valor Unitário (R$);Valor Total (R$)\n`;

    orc.itens?.forEach(it => {
      const q = it.quantidade || '';
      const u = it.unidade || '';
      const vu = it.valorUnitarioCentavos ? (it.valorUnitarioCentavos / 100).toFixed(2).replace('.', ',') : '';
      const vt = (it.valorTotalCentavos / 100).toFixed(2).replace('.', ',');

      // A coluna Código é a do ITEM; antes saía o código do plano de contas,
      // que já tem coluna própria logo adiante.
      const uc = it.centroCustoNome || 'Toda a obra';
      csv += `${it.codigo || ''};"${uc}";${it.planoContaCodigo};${it.planoContaNome};"${it.descricao || ''}";${q};${u};${vu};${vt}\n`;
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

          {/*
            Acompanhamento desligado nesta rodada.

            getOrcamentoExecucao() ainda é servido pelo mock em memória: o
            cadastro já grava no banco, mas orçado × comprometido × realizado e
            a Curva S sairiam de dados inventados. Exibir isso ao lado de uma
            planilha real seria pior do que não exibir.

            Para religar: implemente getOrcamentoExecucao no
            SupabaseErpRepository e devolva o onClick de setActiveTab.
          */}
          <button
            type="button"
            disabled
            title="Acompanhamento e Curva S ainda não estão ligados ao banco — em desenvolvimento."
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-ink-muted/50 cursor-not-allowed"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Acompanhamento &amp; Curva S (em breve)</span>
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

              <button
                onClick={() => { setIsEditing(false); setActiveOrcamento(null); }}
                className="px-4 py-2 bg-black/5 text-ink-primary hover:bg-black/10 rounded-xl text-xs font-bold"
              >
                Fechar Editor
              </button>
            </div>
          </div>

          {/* GRID TIPO PLANILHA */}
          <OrcamentoSpreadsheetEditor
            dataInicio={activeOrcamento.dataInicio}
            dataFim={activeOrcamento.dataFim}
            planosNivel2={planosNivel2}
            subCentrosCusto={unidadesDaObraAtiva}
            initialItens={activeOrcamento.itens}
            isReadonly={activeOrcamento.status === 'aprovado'}
            onSave={handleSaveSpreadsheetItens}
            onCancel={() => { setIsEditing(false); setActiveOrcamento(null); }}
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
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Obra</label>
                  <select
                    value={formCcId}
                    onChange={(e) => setFormCcId(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    {obras.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Nome do Orçamento</label>
                  <input
                    type="text"
                    placeholder="Ex: Orçamento Executivo Villa Alpina 2026"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
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
