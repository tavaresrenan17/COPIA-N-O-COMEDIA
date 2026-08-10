'use client';

import { ModuloDesativado } from '@/components/ModuloDesativado';

import React, { useEffect, useState } from 'react';
import { 
  erpRepository, 
  Recorrencia, 
  Pessoa, 
  PlanoConta, 
  CentroCusto, 
  TipoTitulo,
  FrequenciaRecorrencia,
  TipoValorRecorrencia,
  AjusteDiaUtilRecorrencia,
  IndiceReajusteRecorrencia,
  ProximaOcorrenciaPrevia,
  RecorrenciaRateio,
  RecorrenciaOcorrencia,
  RecorrenciaReajuste,
  LogExecucaoFila,
  Titulo,
  GeracaoRetroativaSimulacaoResultado 
} from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { 
  Repeat, 
  Plus, 
  Zap, 
  Pause, 
  Play, 
  XCircle, 
  Edit3, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  X,
  ArrowRight,
  Clock,
  Building2,
  DollarSign,
  History,
  TrendingUp,
  Sliders,
  ListFilter,
  Check,
  ChevronRight,
  Info,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function RecorrenciasPage() {
  // Aba Principal do Módulo (5 Visões)
  const [activeMainTab, setActiveMainTab] = useState<'listagem' | 'editor' | 'fila' | 'historico' | 'reajuste_lote'>('listagem');

  // Estado dos Dados
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [planosConta, setPlanosConta] = useState<PlanoConta[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [ocorrenciasHistorico, setOcorrenciasHistorico] = useState<RecorrenciaOcorrencia[]>([]);
  const [reajustesHistorico, setReajustesHistorico] = useState<RecorrenciaReajuste[]>([]);
  const [logsFila, setLogsFila] = useState<LogExecucaoFila[]>([]);
  const [titulosAguardandoValor, setTitulosAguardandoValor] = useState<Titulo[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros da Listagem
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroFrequencia, setFiltroFrequencia] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Sub-aba da Fila (1 = Fila do Período, 2 = Aguardando Valor)
  const [activeFilaSubTab, setActiveFilaSubTab] = useState<'periodo' | 'aguardando'>('periodo');

  // Seleção para Ação em Lote de Reajuste
  const [selectedRecorrenciaIds, setSelectedRecorrenciaIds] = useState<string[]>([]);
  const [reajusteLotePercentualStr, setReajusteLotePercentualStr] = useState<string>('5,80');
  const [reajusteLoteIndice, setReajusteLoteIndice] = useState<string>('IGPM');
  const [reajusteLoteObs, setReajusteLoteObs] = useState<string>('');

  // Edição inline de Título Variável Aguardando Valor
  const [inlineValores, setInlineValores] = useState<Record<string, string>>({});

  // Recorrência Selecionada para Histórico
  const [selectedRecorrenciaIdForHistorico, setSelectedRecorrenciaIdForHistorico] = useState<string>('');

  // --- FORMULÁRIO EDITOR DE RECORRÊNCIA ---
  const [editingRecorrencia, setEditingRecorrencia] = useState<Recorrencia | null>(null);
  const [formTipo, setFormTipo] = useState<TipoTitulo>('P');
  const [formPessoaId, setFormPessoaId] = useState('');
  const [formPlanoContaId, setFormPlanoContaId] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValorBrutoReais, setFormValorBrutoReais] = useState('1.500,00');
  const [formTipoValor, setFormTipoValor] = useState<TipoValorRecorrencia>('fixo');
  const [formFrequencia, setFormFrequencia] = useState<FrequenciaRecorrencia>('mensal');
  const [formDiaVencimento, setFormDiaVencimento] = useState(10);
  const [formDiaSemana, setFormDiaSemana] = useState(1); // Segunda
  const [formAjusteDiaUtil, setFormAjusteDiaUtil] = useState<AjusteDiaUtilRecorrencia>('posterga');
  const [formDataInicio, setFormDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [formDataFim, setFormDataFim] = useState('');
  const [formQtdOcorrenciasStr, setFormQtdOcorrenciasStr] = useState('');
  const [formAntecedenciaGeracao, setFormAntecedenciaGeracao] = useState(30);
  const [formGerarAutomatico, setFormGerarAutomatico] = useState(true);
  const [formIndiceReajuste, setFormIndiceReajuste] = useState<IndiceReajusteRecorrencia>('IGPM');
  const [formMesReajuste, setFormMesReajuste] = useState(1);
  const [formPercentualReajusteStr, setFormPercentualReajusteStr] = useState('5,00');
  const [formObservacao, setFormObservacao] = useState('');
  const [formRateios, setFormRateios] = useState<{ centroCustoId: string; percentualStr: string }[]>([]);

  // Tabela de Prévia Obrigatória das Próximas 12 Ocorrências (Editor)
  const [previasCalculadas, setPreviasCalculadas] = useState<ProximaOcorrenciaPrevia[]>([]);

  // Modal Geração Retroativa / Confirmação Prévia (Regra 4)
  const [simulacaoData, setSimulacaoData] = useState<GeracaoRetroativaSimulacaoResultado | null>(null);
  const [modalSimulacaoOpen, setModalSimulacaoOpen] = useState(false);
  const [executandoGerador, setExecutandoGerador] = useState(false);

  // Carregamento de Dados
  useEffect(() => {
    loadData();
  }, [filtroTipo, filtroStatus, filtroFrequencia]);

  async function loadData() {
    setLoading(true);
    const [recList, pesList, pcList, ccList, titulosList, logsList] = await Promise.all([
      erpRepository.getRecorrencias({ 
        tipo: (filtroTipo as TipoTitulo) || undefined, 
        status: (filtroStatus as any) || undefined,
        frequencia: filtroFrequencia || undefined
      }),
      erpRepository.getPessoas({ apenasAtivos: true }),
      erpRepository.getPlanoContasFolhas(),
      erpRepository.getCentroCustosFolhas(),
      erpRepository.getTitulos(),
      erpRepository.getLogsExecucaoFila()
    ]);

    setRecorrencias(recList);
    setPessoas(pesList);
    setPlanosConta(pcList);
    setCentrosCusto(ccList);
    setLogsFila(logsList);

    // Filtra títulos variáveis aguardando valor (aguardandoValor === true)
    const agVal = (titulosList as Titulo[]).filter((t: Titulo) => t.aguardandoValor);
    setTitulosAguardandoValor(agVal);


    if (pesList.length > 0 && !formPessoaId) setFormPessoaId(pesList[0].id);
    if (pcList.length > 0 && !formPlanoContaId) setFormPlanoContaId(pcList[0].id);
    if (ccList.length > 0 && formRateios.length === 0) {
      setFormRateios([{ centroCustoId: ccList[0].id, percentualStr: '100,00' }]);
    }

    if (recList.length > 0 && !selectedRecorrenciaIdForHistorico) {
      setSelectedRecorrenciaIdForHistorico(recList[0].id);
    }

    setLoading(false);
  }

  // Carrega histórico quando seleciona recorrência na aba 4
  useEffect(() => {
    if (selectedRecorrenciaIdForHistorico) {
      loadHistorico(selectedRecorrenciaIdForHistorico);
    }
  }, [selectedRecorrenciaIdForHistorico]);

  async function loadHistorico(recId: string) {
    const [ocList, reajList] = await Promise.all([
      erpRepository.getOcorrenciasByRecorrencia(recId),
      erpRepository.getReajustesByRecorrencia(recId)
    ]);
    setOcorrenciasHistorico(ocList);
    setReajustesHistorico(reajList);
  }

  // RE-CÁLCULO DA PRÉVIA OBRIGATÓRIA NO EDITOR (RODAPÉ EM TEMPO REAL)
  useEffect(() => {
    recalcularPreviasEditor();
  }, [
    formTipo, formValorBrutoReais, formTipoValor, formFrequencia, formDiaVencimento, 
    formDiaSemana, formAjusteDiaUtil, formDataInicio, formDataFim, formQtdOcorrenciasStr
  ]);

  async function recalcularPreviasEditor() {
    const valCentavos = Math.round((parseFloat(formValorBrutoReais.replace(/\./g, '').replace(',', '.')) || 0) * 100);
    const qtdOcor = parseInt(formQtdOcorrenciasStr, 10) || undefined;

    const res = await erpRepository.calcularProximasOcorrencias({
      tipo: formTipo,
      valorBrutoCentavos: valCentavos,
      tipoValor: formTipoValor,
      frequencia: formFrequencia,
      diaVencimento: formDiaVencimento,
      diaSemana: formDiaSemana,
      ajusteDiaUtil: formAjusteDiaUtil,
      dataInicio: formDataInicio,
      dataFim: formDataFim || undefined,
      qtdOcorrencias: qtdOcor
    }, 12);

    setPreviasCalculadas(res);
  }

  // KPI CARDS
  const totalMensalPagarCentavos = recorrencias
    .filter(r => r.tipo === 'P' && r.status === 'ativa' && r.frequencia === 'mensal')
    .reduce((sum, r) => sum + r.valorBrutoCentavos, 0);

  const totalMensalReceberCentavos = recorrencias
    .filter(r => r.tipo === 'R' && r.status === 'ativa' && r.frequencia === 'mensal')
    .reduce((sum, r) => sum + r.valorBrutoCentavos, 0);

  const qtdAtivas = recorrencias.filter(r => r.status === 'ativa').length;

  // Ações do Gerador
  async function handleExecutarGeradorManual(recIdTarget?: string) {
    const sim = await erpRepository.simularGeracaoRetroativa(recIdTarget);
    if (sim.totalTitulos === 0) {
      alert('Todas as ocorrências já foram geradas! NENHUM título novo a ser criado (Idempotência OK).');
      return;
    }
    setSimulacaoData(sim);
    setModalSimulacaoOpen(true);
  }

  async function handleConfirmarGeracaoRetroativa() {
    setExecutandoGerador(true);
    try {
      const res = await erpRepository.gerarTitulosRecorrentes();
      alert(`Sucesso! Foram gerados ${res.qtdGerados} títulos normais totalizando ${formatCurrency(res.valorTotalCentavos)}.`);
      setModalSimulacaoOpen(false);
      setSimulacaoData(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao executar gerador.');
    }
    setExecutandoGerador(false);
  }

  async function handleProcessarFilaAgora() {
    setExecutandoGerador(true);
    const logRes = await erpRepository.processarFila();
    alert(`Fila processada! ${logRes.qtdGeradas} títulos gerados automaticamente, ${logRes.qtdPuladas} mantidos/pulados.`);
    setExecutandoGerador(false);
    await loadData();
  }

  // Ações de Template
  async function handlePausarRecorrencia(id: string) {
    await erpRepository.pausarRecorrencia(id);
    await loadData();
  }

  async function handleReativarRecorrencia(id: string) {
    await erpRepository.reativarRecorrencia(id);
    await loadData();
  }

  async function handleEncerrarRecorrencia(id: string) {
    if (!confirm('Deseja encerrar esta recorrência? Títulos já gerados no passado NÃO serão apagados.')) return;
    await erpRepository.encerrarRecorrencia(id);
    await loadData();
  }

  function handleOpenNewEditor() {
    setEditingRecorrencia(null);
    setFormDescricao('');
    setFormValorBrutoReais('1.500,00');
    setFormTipoValor('fixo');
    setFormFrequencia('mensal');
    setFormDiaVencimento(10);
    setFormAjusteDiaUtil('posterga');
    setFormDataInicio(new Date().toISOString().split('T')[0]);
    setFormDataFim('');
    setFormQtdOcorrenciasStr('');
    setFormObservacao('');
    if (centrosCusto.length > 0) {
      setFormRateios([{ centroCustoId: centrosCusto[0].id, percentualStr: '100,00' }]);
    }
    setActiveMainTab('editor');
  }

  function handleOpenEditEditor(rec: Recorrencia) {
    setEditingRecorrencia(rec);
    setFormTipo(rec.tipo);
    setFormPessoaId(rec.pessoaId);
    setFormPlanoContaId(rec.planoContaId);
    setFormDescricao(rec.descricao);
    setFormTipoValor(rec.tipoValor);
    setFormFrequencia(rec.frequencia);
    setFormDiaVencimento(rec.diaVencimento || 10);
    setFormDiaSemana(rec.diaSemana || 1);
    setFormAjusteDiaUtil(rec.ajusteDiaUtil);
    setFormDataInicio(rec.dataInicio);
    setFormDataFim(rec.dataFim || '');
    setFormQtdOcorrenciasStr(rec.qtdOcorrencias ? String(rec.qtdOcorrencias) : '');
    setFormAntecedenciaGeracao(rec.antecedenciaGeracao);
    setFormGerarAutomatico(rec.gerarAutomatico);
    setFormIndiceReajuste(rec.indiceReajuste);
    setFormMesReajuste(rec.mesReajuste || 1);
    setFormPercentualReajusteStr(rec.percentualReajuste ? String(rec.percentualReajuste).replace('.', ',') : '5,00');
    setFormObservacao(rec.observacao || '');

    if (rec.rateios && rec.rateios.length > 0) {
      setFormRateios(rec.rateios.map(r => ({ centroCustoId: r.centroCustoId, percentualStr: r.percentual.toFixed(2).replace('.', ',') })));
    } else if (centrosCusto.length > 0) {
      setFormRateios([{ centroCustoId: centrosCusto[0].id, percentualStr: '100,00' }]);
    }

    setActiveMainTab('editor');
  }

  // Rateio por Centro de Custo no Editor (Soma 100%)
  const somaPercentualRateio = formRateios.reduce((sum, r) => sum + (parseFloat(r.percentualStr.replace(',', '.')) || 0), 0);
  const isRateioValido = Math.abs(somaPercentualRateio - 100) < 0.01;

  async function handleSaveEditor(e: React.FormEvent) {
    e.preventDefault();

    if (!isRateioValido) {
      alert(`O rateio por Centro de Custo deve somar exatamente 100,00%. Atualmente soma ${somaPercentualRateio.toFixed(2)}%.`);
      return;
    }

    const valCentavos = Math.round((parseFloat(formValorBrutoReais.replace(/\./g, '').replace(',', '.')) || 0) * 100);
    const rateiosConvertidos = formRateios.map(r => ({
      centroCustoId: r.centroCustoId,
      percentual: parseFloat(r.percentualStr.replace(',', '.')) || 0
    }));

    try {
      if (editingRecorrencia) {
        // REGRA DE OURO 2: Alteração vale da próxima ocorrência em diante. Títulos gerados não mudam!
        await erpRepository.updateRecorrencia(editingRecorrencia.id, {
          tipo: formTipo,
          pessoaId: formPessoaId,
          planoContaId: formPlanoContaId,
          descricao: formDescricao,
          valorBrutoCentavos: valCentavos,
          tipoValor: formTipoValor,
          frequencia: formFrequencia,
          diaVencimento: formDiaVencimento,
          diaSemana: formDiaSemana,
          ajusteDiaUtil: formAjusteDiaUtil,
          dataInicio: formDataInicio,
          dataFim: formDataFim || undefined,
          qtdOcorrencias: parseInt(formQtdOcorrenciasStr, 10) || undefined,
          antecedenciaGeracao: formAntecedenciaGeracao,
          gerarAutomatico: formGerarAutomatico,
          indiceReajuste: formIndiceReajuste,
          mesReajuste: formMesReajuste,
          percentualReajuste: parseFloat(formPercentualReajusteStr.replace(',', '.')) || 0,
          observacao: formObservacao,
          rateios: rateiosConvertidos
        });
      } else {
        await erpRepository.createRecorrencia({
          tipo: formTipo,
          pessoaId: formPessoaId,
          planoContaId: formPlanoContaId,
          descricao: formDescricao,
          valorBrutoCentavos: valCentavos,
          tipoValor: formTipoValor,
          frequencia: formFrequencia,
          diaVencimento: formDiaVencimento,
          diaSemana: formDiaSemana,
          ajusteDiaUtil: formAjusteDiaUtil,
          dataInicio: formDataInicio,
          dataFim: formDataFim || undefined,
          qtdOcorrencias: parseInt(formQtdOcorrenciasStr, 10) || undefined,
          antecedenciaGeracao: formAntecedenciaGeracao,
          gerarAutomatico: formGerarAutomatico,
          indiceReajuste: formIndiceReajuste,
          mesReajuste: formMesReajuste,
          percentualReajuste: parseFloat(formPercentualReajusteStr.replace(',', '.')) || 0,
          status: 'ativa',
          observacao: formObservacao,
          ativo: true,
          rateios: rateiosConvertidos
        });
      }

      alert('Template de recorrência salvo com sucesso!');
      setActiveMainTab('listagem');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar recorrência.');
    }
  }

  // Preencher valor de título variável inline (Sub-aba Aguardando Valor)
  async function handleSalvarInlineValor(tituloId: string) {
    const str = inlineValores[tituloId];
    const valCentavos = Math.round((parseFloat(str?.replace(/\./g, '').replace(',', '.') || '0')) * 100);

    if (valCentavos <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    await erpRepository.preencherValorTituloVariavel(tituloId, valCentavos);
    alert('Valor preenchido com sucesso! O título agora integra o Fluxo de Caixa e o Comprometido.');
    await loadData();
  }

  // Ação em Lote de Reajuste (Aba 5)
  function toggleSelectRecorrencia(id: string) {
    setSelectedRecorrenciaIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }

  function toggleSelectAllRecorrencias() {
    if (selectedRecorrenciaIds.length === recorrencias.length) {
      setSelectedRecorrenciaIds([]);
    } else {
      setSelectedRecorrenciaIds(recorrencias.map(r => r.id));
    }
  }

  async function handleAplicarReajusteEmLoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRecorrenciaIds.length === 0) {
      alert('Selecione pelo menos uma recorrência para aplicar o reajuste.');
      return;
    }

    const pct = parseFloat(reajusteLotePercentualStr.replace(',', '.')) || 0;
    if (pct <= 0) {
      alert('Informe um percentual de reajuste positivo.');
      return;
    }

    if (!confirm(`Confirma a aplicação do reajuste de ${pct.toFixed(2)}% (${reajusteLoteIndice}) para as ${selectedRecorrenciaIds.length} recorrências selecionadas?`)) return;

    await erpRepository.aplicarReajusteEmLote(selectedRecorrenciaIds, pct, reajusteLoteIndice, reajusteLoteObs);
    alert('Reajuste em lote aplicado com sucesso! Templates atualizados (títulos já gerados no passado foram mantidos intactos).');
    setSelectedRecorrenciaIds([]);
    setActiveMainTab('listagem');
    await loadData();
  }

  const filteredRecorrencias = recorrencias.filter(r => {
    const st = searchTerm.toLowerCase();
    return (
      r.descricao.toLowerCase().includes(st) ||
      (r.pessoaNome || '').toLowerCase().includes(st) ||
      (r.planoContaNome || '').toLowerCase().includes(st)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <div className="flex items-center gap-2 text-brand mb-1">
            <Repeat className="w-5 h-5 stroke-[2.5]" />
            <span className="text-xs font-bold uppercase tracking-wider">Módulo de Automação Financiera</span>
          </div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">Gestão &amp; Gerador de Recorrências</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Templates relativas com vencimentos ajustados por dias úteis/feriados, idempotência estrita e reajustes contratuais.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleProcessarFilaAgora}
            disabled={executandoGerador}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-bold shadow-soft transition-all"
          >
            <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
            <span>⚡ Processar Fila Agora</span>
          </button>

          <button
            onClick={handleOpenNewEditor}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Recorrência</span>
          </button>
        </div>
      </div>

      {/* BARRA DE NAVEGAÇÃO POR ABAS (5 VISÕES PRINCIPAIS) */}
      <div className="flex items-center gap-2 bg-surface p-1.5 rounded-2xl shadow-soft border border-black/[0.04] overflow-x-auto">
        <button
          onClick={() => setActiveMainTab('listagem')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeMainTab === 'listagem' ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink-primary hover:bg-black/5'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>1. Listagem de Recorrências</span>
        </button>

        <button
          onClick={() => setActiveMainTab('editor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeMainTab === 'editor' ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink-primary hover:bg-black/5'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>2. Editor &amp; Prévia 12 Ocorrências</span>
        </button>

        <button
          onClick={() => setActiveMainTab('fila')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap relative ${
            activeMainTab === 'fila' ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink-primary hover:bg-black/5'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>3. Fila &amp; Aguardando Valor</span>
          {titulosAguardandoValor.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {titulosAguardandoValor.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveMainTab('historico')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeMainTab === 'historico' ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink-primary hover:bg-black/5'
          }`}
        >
          <History className="w-4 h-4" />
          <span>4. Histórico &amp; Auditoria</span>
        </button>

        <button
          onClick={() => setActiveMainTab('reajuste_lote')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeMainTab === 'reajuste_lote' ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink-primary hover:bg-black/5'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>5. Reajuste em Lote</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* ABA 1: LISTAGEM DE RECORRÊNCIAS + CARDS KPI */}
      {/* =================================================================== */}
      {activeMainTab === 'listagem' && (
        <div className="space-y-6">
          {/* CARDS KPI DE TOPO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Total Mensal Recorrente A Pagar</span>
              <div className="text-xl font-bold font-mono text-rose-600 mt-1">
                {formatCurrency(totalMensalPagarCentavos)}
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">Compromisso fixo mensal</span>
            </div>

            <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total Mensal Recorrente A Receber</span>
              <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
                {formatCurrency(totalMensalReceberCentavos)}
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">Entrada fixa mensal</span>
            </div>

            <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-brand uppercase tracking-wider block">Recorrências Ativas</span>
              <div className="text-xl font-bold font-mono text-ink-primary mt-1">
                {qtdAtivas} templates
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">Em execução no gerador</span>
            </div>

            <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Títulos Aguardando Valor</span>
              <div className="text-xl font-bold font-mono text-amber-600 mt-1">
                {titulosAguardandoValor.length} pendentes
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">Recorrências variáveis sem valor</span>
            </div>
          </div>

          {/* FILTROS DA LISTAGEM */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface p-4 rounded-2xl shadow-soft border border-black/[0.03]">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por descrição, fornecedor ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-muted border border-black/[0.06] rounded-xl pl-11 pr-4 py-2.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/40 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-surface-muted px-3 py-2 rounded-xl border border-black/5">
                <Filter className="w-4 h-4 text-ink-muted" />
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-ink-primary focus:outline-none"
                >
                  <option value="">Todos os Tipos</option>
                  <option value="P">Contas a Pagar</option>
                  <option value="R">Contas a Receber</option>
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
                  <option value="ativa">Ativa</option>
                  <option value="pausada">Pausada</option>
                  <option value="encerrada">Encerrada</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-surface-muted px-3 py-2 rounded-xl border border-black/5">
                <Filter className="w-4 h-4 text-ink-muted" />
                <select
                  value={filtroFrequencia}
                  onChange={(e) => setFiltroFrequencia(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-ink-primary focus:outline-none"
                >
                  <option value="">Todas Frequências</option>
                  <option value="mensal">Mensal</option>
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABELA DE LISTAGEM DE RECORRÊNCIAS */}
          <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.03] overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-ink-muted animate-pulse">Carregando templates...</div>
            ) : filteredRecorrencias.length === 0 ? (
              <div className="p-12 text-center text-ink-muted space-y-3">
                <Repeat className="w-10 h-10 text-ink-muted/40 mx-auto" />
                <p className="text-xs">Nenhum template de recorrência encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                      <th className="py-3 px-4 text-center">Tipo</th>
                      <th className="py-3 px-4">Descrição do Template</th>
                      <th className="py-3 px-4">Cliente / Fornecedor</th>
                      <th className="py-3 px-4">Plano de Contas</th>
                      <th className="py-3 px-4 text-center">Frequência / Dia</th>
                      <th className="py-3 px-4 text-right">Valor (R$)</th>
                      <th className="py-3 px-4 text-center">Próximo Vencimento</th>
                      <th className="py-3 px-4 text-center">Geração</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 font-medium">
                    {filteredRecorrencias.map((rec) => (
                      <tr key={rec.id} className="hover:bg-black/[0.02] transition-colors">
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.tipo === 'P' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {rec.tipo === 'P' ? 'PAGAR' : 'RECEBER'}
                          </span>
                        </td>

                        <td className="py-4 px-4 font-bold text-ink-primary">
                          <span>{rec.descricao}</span>
                          {rec.tipoValor === 'variavel' && (
                            <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                              VARIÁVEL
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-ink-primary font-semibold">
                          {rec.pessoaNome || '-'}
                        </td>

                        <td className="py-4 px-4 text-ink-muted">
                          {rec.planoContaNome || '-'}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className="font-bold text-ink-primary capitalize block">{rec.frequencia}</span>
                          <span className="text-[10px] text-ink-muted block font-mono">
                            Dia Venc: {rec.diaVencimento || rec.diaSemana || 10} ({rec.ajusteDiaUtil})
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right font-mono font-bold text-ink-primary">
                          {rec.tipoValor === 'variavel' ? (
                            <span className="text-amber-600">Variável</span>
                          ) : (
                            formatCurrency(rec.valorBrutoCentavos)
                          )}
                        </td>

                        <td className="py-4 px-4 text-center font-mono font-semibold text-brand">
                          {rec.proximaCompetencia.split('-').reverse().join('/')}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            rec.gerarAutomatico ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}>
                            {rec.gerarAutomatico ? '⚡ Automática' : '👤 Manual'}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.status === 'ativa'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : rec.status === 'pausada'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                            {rec.status.toUpperCase()}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {rec.status === 'ativa' && (
                              <button
                                onClick={() => handleExecutarGeradorManual(rec.id)}
                                title="Gerar Ocorrência Manual Agora"
                                className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg border border-amber-200 transition-all"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {rec.status === 'ativa' ? (
                              <button
                                onClick={() => handlePausarRecorrencia(rec.id)}
                                title="Pausar Template"
                                className="p-1.5 bg-surface border border-black/10 text-ink-muted hover:text-amber-600 rounded-lg transition-all"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            ) : rec.status === 'pausada' ? (
                              <button
                                onClick={() => handleReativarRecorrencia(rec.id)}
                                title="Reativar Template"
                                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-all"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            ) : null}

                            <button
                              onClick={() => handleOpenEditEditor(rec)}
                              title="Editar Template no Editor"
                              className="p-1.5 bg-surface border border-black/10 text-ink-muted hover:text-brand rounded-lg transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {rec.status !== 'encerrada' && (
                              <button
                                onClick={() => handleEncerrarRecorrencia(rec.id)}
                                title="Encerrar Template (Não apaga títulos históricos)"
                                className="p-1.5 bg-surface border border-black/10 text-ink-muted hover:text-rose-600 rounded-lg transition-all"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* ABA 2: EDITOR DE RECORRÊNCIA + PRÉVIA OBRIGATÓRIA DAS 12 OCORRÊNCIAS */}
      {/* =================================================================== */}
      {activeMainTab === 'editor' && (
        <form onSubmit={handleSaveEditor} className="space-y-6">
          <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div>
                <span className="text-xs font-bold text-brand uppercase tracking-wider">Aba 2: Configuração de Regras</span>
                <h2 className="text-lg font-bold text-ink-primary">
                  {editingRecorrencia ? `Editar Recorrência: ${editingRecorrencia.descricao}` : 'Novo Template de Recorrência'}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveMainTab('listagem')}
                  className="px-4 py-2 bg-black/5 hover:bg-black/10 text-ink-primary rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  Salvar Recorrência
                </button>
              </div>
            </div>

            {/* BLOCO 1: LANÇAMENTO BASE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Tipo de Título</label>
                <select
                  value={formTipo}
                  onChange={(e) => setFormTipo(e.target.value as TipoTitulo)}
                  className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="P">Conta a Pagar (Despesa)</option>
                  <option value="R">Conta a Receber (Receita)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">
                  {formTipo === 'P' ? 'Fornecedor' : 'Cliente'}
                </label>
                <select
                  value={formPessoaId}
                  onChange={(e) => setFormPessoaId(e.target.value)}
                  required
                  className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {pessoas.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Plano de Contas</label>
                <select
                  value={formPlanoContaId}
                  onChange={(e) => setFormPlanoContaId(e.target.value)}
                  required
                  className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {planosConta.map(pc => (
                    <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-ink-muted mb-1">Descrição do Template</label>
                <input
                  type="text"
                  placeholder="Ex: Aluguel de gerador canteiro / Condomínio filial"
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  required
                  className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Tipo Valor</label>
                  <select
                    value={formTipoValor}
                    onChange={(e) => setFormTipoValor(e.target.value as TipoValorRecorrencia)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="fixo">Fixo</option>
                    <option value="variavel">Variável (Digitar na Fila)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Valor (R$)</label>
                  <input
                    type="text"
                    disabled={formTipoValor === 'variavel'}
                    value={formTipoValor === 'variavel' ? 'Aguardando' : formValorBrutoReais}
                    onChange={(e) => setFormValorBrutoReais(e.target.value)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand font-mono disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* BLOCO 2: RATEIO POR CENTRO DE CUSTO (VALIDAÇÃO ESTREITA 100%) */}
            <div className="border-t border-black/5 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-primary">Rateio por Centro de Custo</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                  isRateioValido ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  Total: {somaPercentualRateio.toFixed(2)}%
                </span>
              </div>

              <div className="space-y-2">
                {formRateios.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-surface-muted p-2.5 rounded-xl border border-black/10">
                    <select
                      value={r.centroCustoId}
                      onChange={(e) => {
                        const copy = [...formRateios];
                        copy[idx].centroCustoId = e.target.value;
                        setFormRateios(copy);
                      }}
                      className="flex-1 bg-surface border border-black/10 rounded-lg px-2.5 py-1.5 text-xs text-ink-primary"
                    >
                      {centrosCusto.map(cc => (
                        <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>
                      ))}
                    </select>

                    <div className="w-24 relative">
                      <input
                        type="text"
                        value={r.percentualStr}
                        onChange={(e) => {
                          const copy = [...formRateios];
                          copy[idx].percentualStr = e.target.value;
                          setFormRateios(copy);
                        }}
                        className="w-full bg-surface border border-black/10 rounded-lg pr-6 pl-2.5 py-1.5 text-xs font-bold text-ink-primary text-right"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-muted">%</span>
                    </div>

                    {formRateios.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormRateios(formRateios.filter((_, i) => i !== idx))}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* BLOCO 3: REGRA DE REPETIÇÃO & AJUSTE DE DIA ÚTIL */}
            <div className="border-t border-black/5 pt-4 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-primary block">Regra de Frequência &amp; Vencimento</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Frequência</label>
                  <select
                    value={formFrequencia}
                    onChange={(e) => setFormFrequencia(e.target.value as FrequenciaRecorrencia)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="semanal">Semanal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="bimestral">Bimestral</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Dia Vencimento (1 a 31)
                    <span className="text-[10px] text-ink-muted block font-normal">Ajusta em mês curto</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formDiaVencimento}
                    onChange={(e) => setFormDiaVencimento(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Ajuste de Dia Útil / Feriado</label>
                  <select
                    value={formAjusteDiaUtil}
                    onChange={(e) => setFormAjusteDiaUtil(e.target.value as AjusteDiaUtilRecorrencia)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="nenhum">Nenhum (Manter data exata)</option>
                    <option value="antecipa">Antecipa (Sexta / Dia Útil Anterior)</option>
                    <option value="posterga">Posterga (Segunda / Dia Útil Seguinte)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Antecedência Geração (Dias)</label>
                  <input
                    type="number"
                    value={formAntecedenciaGeracao}
                    onChange={(e) => setFormAntecedenciaGeracao(parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Data Início</label>
                  <input
                    type="date"
                    value={formDataInicio}
                    onChange={(e) => setFormDataInicio(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Data Fim (Opcional)</label>
                  <input
                    type="date"
                    value={formDataFim}
                    onChange={(e) => setFormDataFim(e.target.value)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Qtd Máxima Ocorrências</label>
                  <input
                    type="number"
                    placeholder="Sem limite"
                    value={formQtdOcorrenciasStr}
                    onChange={(e) => setFormQtdOcorrenciasStr(e.target.value)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Modo de Geração</label>
                  <label className="flex items-center gap-2 pt-2 cursor-pointer text-xs font-bold text-ink-primary">
                    <input
                      type="checkbox"
                      checked={formGerarAutomatico}
                      onChange={(e) => setFormGerarAutomatico(e.target.checked)}
                      className="rounded border-black/20 text-brand focus:ring-brand w-4 h-4"
                    />
                    <span>Gerar Automaticamente na Fila</span>
                  </label>
                </div>
              </div>
            </div>

            {/* PRÉVIA OBRIGATÓRIA NO RODAPÉ DAS PRÓXIMAS 12 OCORRÊNCIAS EM TEMPO REAL */}
            <div className="border-t-2 border-brand/20 pt-4 space-y-3 bg-brand/[0.02] p-4 rounded-2xl border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  PRÉVIA OBRIGATÓRIA DAS PRÓXIMAS 12 OCORRÊNCIAS (EM TEMPO REAL)
                </span>
                <span className="text-[11px] text-ink-muted italic">
                  Atualizada dinamicamente conforme você altera os parâmetros da regra
                </span>
              </div>

              <div className="border border-black/10 rounded-xl overflow-hidden bg-surface text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                      <th className="p-2.5 text-center">#</th>
                      <th className="p-2.5">Competência</th>
                      <th className="p-2.5">Data Vencimento Ajustada</th>
                      <th className="p-2.5">Dia da Semana</th>
                      <th className="p-2.5 text-center">Status Ajuste</th>
                      <th className="p-2.5 text-right">Valor Previsto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 font-medium">
                    {previasCalculadas.map((prev, idx) => (
                      <tr key={idx} className="hover:bg-black/[0.02]">
                        <td className="p-2.5 text-center font-bold text-ink-muted">{idx + 1}</td>
                        <td className="p-2.5 font-mono">{prev.competencia}</td>
                        <td className="p-2.5 font-mono font-bold text-brand">{prev.dataVencimento.split('-').reverse().join('/')}</td>
                        <td className="p-2.5">{prev.diaSemanaRotulo}</td>
                        <td className="p-2.5 text-center">
                          {prev.isAjustadoDiaUtil ? (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                              ⚠️ Ajustado (Fim de Semana / Feriado)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                              ✓ Dia Útil Regular
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-ink-primary">
                          {formTipoValor === 'variavel' ? 'Variável' : formatCurrency(prev.valorCentavos)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* =================================================================== */}
      {/* ABA 3: FILA DE GERAÇÃO & AGUARDANDO VALOR (SUB-ABAS) */}
      {/* =================================================================== */}
      {activeMainTab === 'fila' && (
        <div className="space-y-6">
          {/* SUB-ABAS DA FILA */}
          <div className="flex items-center gap-2 border-b border-black/10 pb-2">
            <button
              onClick={() => setActiveFilaSubTab('periodo')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFilaSubTab === 'periodo' ? 'bg-brand text-white shadow' : 'bg-surface text-ink-muted hover:text-ink-primary'
              }`}
            >
              ⚡ 1. Ocorrências a Gerar no Período
            </button>

            <button
              onClick={() => setActiveFilaSubTab('aguardando')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeFilaSubTab === 'aguardando' ? 'bg-amber-600 text-white shadow' : 'bg-surface text-ink-muted hover:text-ink-primary'
              }`}
            >
              <span>✏️ 2. Títulos Variáveis Aguardando Valor</span>
              {titulosAguardandoValor.length > 0 && (
                <span className="bg-white text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {titulosAguardandoValor.length}
                </span>
              )}
            </button>
          </div>

          {activeFilaSubTab === 'periodo' ? (
            <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-ink-primary">Ocorrências Pendentes de Geração no Período</h3>
                  <p className="text-xs text-ink-muted">
                    Recorrências ativas cuja próxima competência está dentro da janela de antecedência configurada.
                  </p>
                </div>

                <button
                  onClick={handleProcessarFilaAgora}
                  disabled={executandoGerador}
                  className="px-4 py-2 bg-brand text-white hover:bg-brand-hover rounded-xl text-xs font-bold shadow transition-all"
                >
                  ⚡ Executar Gerador Agora
                </button>
              </div>

              <div className="border border-black/10 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                      <th className="p-3">Recorrência / Descrição</th>
                      <th className="p-3">Cliente / Fornecedor</th>
                      <th className="p-3 text-center">Competência</th>
                      <th className="p-3 text-center">Modo Geração</th>
                      <th className="p-3 text-right">Valor Estimado</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 font-medium">
                    {recorrencias.filter(r => r.status === 'ativa').map(rec => (
                      <tr key={rec.id} className="hover:bg-black/[0.02]">
                        <td className="p-3">
                          <span className="font-bold text-ink-primary block">{rec.descricao}</span>
                          <span className="text-[10px] text-ink-muted font-mono">{rec.frequencia.toUpperCase()} • Dia Venc: {rec.diaVencimento}</span>
                        </td>
                        <td className="p-3">{rec.pessoaNome}</td>
                        <td className="p-3 text-center font-mono font-bold text-brand">{rec.proximaCompetencia}</td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            rec.gerarAutomatico ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {rec.gerarAutomatico ? '⚡ Automático' : '👤 Sugestão Fila'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          {rec.tipoValor === 'variavel' ? 'Variável' : formatCurrency(rec.valorBrutoCentavos)}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleExecutarGeradorManual(rec.id)}
                            className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600"
                          >
                            Gerar Este Título
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-amber-800">Títulos Variáveis Aguardando Digitação de Valor</h3>
                  <p className="text-xs text-ink-muted">
                    Estes títulos foram gerados com R$ 0,00 e <strong>NÃO entram no Fluxo de Caixa nem no Comprometido</strong> até que o valor seja digitado abaixo.
                  </p>
                </div>
              </div>

              {titulosAguardandoValor.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-muted italic border border-dashed border-black/10 rounded-xl">
                  Nenhum título variável aguardando digitação no momento.
                </div>
              ) : (
                <div className="border border-black/10 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-amber-50 text-[11px] font-bold text-amber-900 uppercase border-b border-amber-200">
                        <th className="p-3">Título / Descrição</th>
                        <th className="p-3">Fornecedor / Cliente</th>
                        <th className="p-3 text-center">Competência</th>
                        <th className="p-3 text-center">Vencimento</th>
                        <th className="p-3 text-right w-48">Digitação Inline do Valor (R$)</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 font-medium">
                      {titulosAguardandoValor.map(t => (
                        <tr key={t.id} className="hover:bg-amber-50/40">
                          <td className="p-3">
                            <span className="font-bold text-ink-primary block">{t.descricao}</span>
                            <span className="text-[10px] text-amber-700 font-mono">Doc: {t.numeroDocumento || '-'}</span>
                          </td>
                          <td className="p-3 font-semibold">{t.pessoaNome}</td>
                          <td className="p-3 text-center font-mono">{t.dataCompetencia}</td>
                          <td className="p-3 text-center font-mono font-bold text-brand">{t.parcelas?.[0]?.dataVencimento.split('-').reverse().join('/')}</td>
                          <td className="p-3 text-right">
                            <input
                              type="text"
                              placeholder="0,00"
                              value={inlineValores[t.id] ?? ''}
                              onChange={(e) => setInlineValores({ ...inlineValores, [t.id]: e.target.value })}
                              className="w-36 bg-surface border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-ink-primary text-right font-mono focus:ring-2 focus:ring-amber-500"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleSalvarInlineValor(t.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
                            >
                              Confirmar &amp; Liberar Caixa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* ABA 4: HISTÓRICO & AUDITORIA DA RECORRÊNCIA */}
      {/* =================================================================== */}
      {activeMainTab === 'historico' && (
        <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-4">
            <div>
              <span className="text-xs font-bold text-brand uppercase tracking-wider">Aba 4: Trilha de Auditoria</span>
              <h2 className="text-lg font-bold text-ink-primary">Histórico de Ocorrências Geradas &amp; Linha do Tempo</h2>
            </div>

            <div className="flex items-center gap-2 bg-surface-muted px-3 py-2 rounded-xl border border-black/10">
              <Building2 className="w-4 h-4 text-ink-muted" />
              <select
                value={selectedRecorrenciaIdForHistorico}
                onChange={(e) => setSelectedRecorrenciaIdForHistorico(e.target.value)}
                className="bg-transparent text-xs font-bold text-ink-primary focus:outline-none"
              >
                {recorrencias.map(r => (
                  <option key={r.id} value={r.id}>{r.descricao} ({r.pessoaNome})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OCORRÊNCIAS HISTÓRICAS */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-primary block flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand" />
                Ocorrências Históricas Geradas ({ocorrenciasHistorico.length})
              </span>

              {ocorrenciasHistorico.length === 0 ? (
                <p className="text-xs text-ink-muted italic border border-dashed border-black/10 p-4 rounded-xl">Nenhuma ocorrência registrada ainda.</p>
              ) : (
                <div className="border border-black/10 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                        <th className="p-2.5">Competência</th>
                        <th className="p-2.5">Vencimento</th>
                        <th className="p-2.5 text-right">Valor Gerado</th>
                        <th className="p-2.5 text-center">Origem / Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 font-medium">
                      {ocorrenciasHistorico.map(oc => (
                        <tr key={oc.id} className="hover:bg-black/[0.02]">
                          <td className="p-2.5 font-mono font-bold">{oc.competencia}</td>
                          <td className="p-2.5 font-mono">{oc.dataVencimento.split('-').reverse().join('/')}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-ink-primary">{formatCurrency(oc.valorGeradoCentavos)}</td>
                          <td className="p-2.5 text-center">
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                              {oc.status.toUpperCase()} ({oc.origem})
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* HISTÓRICO DE REAJUSTES */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-primary block flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                Linha do Tempo de Reajustes Contratuais ({reajustesHistorico.length})
              </span>

              {reajustesHistorico.length === 0 ? (
                <p className="text-xs text-ink-muted italic border border-dashed border-black/10 p-4 rounded-xl">Nenhum reajuste aplicado até o momento.</p>
              ) : (
                <div className="border border-black/10 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-purple-50 text-[11px] font-bold text-purple-900 uppercase border-b border-purple-200">
                        <th className="p-2.5">Data Reajuste</th>
                        <th className="p-2.5 text-right">Valor Anterior</th>
                        <th className="p-2.5 text-right">Valor Novo</th>
                        <th className="p-2.5 text-center">% Índice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 font-medium">
                      {reajustesHistorico.map(rj => (
                        <tr key={rj.id} className="hover:bg-purple-50/30">
                          <td className="p-2.5 font-mono">{rj.dataReajuste.split('-').reverse().join('/')}</td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(rj.valorAnteriorCentavos)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-purple-700">{formatCurrency(rj.valorNovoCentavos)}</td>
                          <td className="p-2.5 text-center font-bold text-purple-800">+{rj.percentual}% ({rj.indice})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* ABA 5: AÇÃO EM LOTE DE REAJUSTE CONTRATUAL */}
      {/* =================================================================== */}
      {activeMainTab === 'reajuste_lote' && (
        <form onSubmit={handleAplicarReajusteEmLoteSubmit} className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-6">
          <div className="border-b border-black/5 pb-4">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block">Aba 5: Operação em Lote</span>
            <h2 className="text-lg font-bold text-ink-primary">Reajuste Contratual de Múltiplas Recorrências</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Selecione as recorrências desejadas e aplique um percentual de reajuste de uma só vez. <strong>Títulos gerados no passado mantêm-se inalterados.</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-purple-50/50 p-4 rounded-2xl border border-purple-200">
            <div>
              <label className="block text-xs font-bold text-purple-900 mb-1">Percentual de Reajuste (%)</label>
              <input
                type="text"
                value={reajusteLotePercentualStr}
                onChange={(e) => setReajusteLotePercentualStr(e.target.value)}
                required
                className="w-full bg-surface border border-purple-300 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-900 mb-1">Índice / Motivo</label>
              <select
                value={reajusteLoteIndice}
                onChange={(e) => setReajusteLoteIndice(e.target.value)}
                className="w-full bg-surface border border-purple-300 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary"
              >
                <option value="IGPM">IGP-M (FGV)</option>
                <option value="IPCA">IPCA (IBGE)</option>
                <option value="fixo">Acordo Fixo Contratual</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-900 mb-1">Observações do Reajuste</label>
              <input
                type="text"
                placeholder="Ex: Reajuste anual 2026 cláusula 5"
                value={reajusteLoteObs}
                onChange={(e) => setReajusteLoteObs(e.target.value)}
                className="w-full bg-surface border border-purple-300 rounded-xl px-3 py-2 text-xs text-ink-primary"
              />
            </div>
          </div>

          {/* TABELA ANTES VS DEPOIS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                Selecione os Templates para Aplicar ({selectedRecorrenciaIds.length} selecionados)
              </span>

              <button
                type="button"
                onClick={toggleSelectAllRecorrencias}
                className="text-xs font-bold text-brand hover:underline"
              >
                {selectedRecorrenciaIds.length === recorrencias.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            <div className="border border-black/10 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                    <th className="p-3 w-10 text-center">Sel</th>
                    <th className="p-3">Descrição / Fornecedor</th>
                    <th className="p-3 text-right">Valor Atual (R$)</th>
                    <th className="p-3 text-right text-purple-700 bg-purple-50">Novo Valor Reajustado (R$)</th>
                    <th className="p-3 text-right text-purple-700 bg-purple-50">Variação R$</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 font-medium">
                  {recorrencias.map(rec => {
                    const isSel = selectedRecorrenciaIds.includes(rec.id);
                    const pct = parseFloat(reajusteLotePercentualStr.replace(',', '.')) || 0;
                    const novoValCentavos = Math.round(rec.valorBrutoCentavos * (1 + pct / 100));
                    const diffCentavos = novoValCentavos - rec.valorBrutoCentavos;

                    return (
                      <tr 
                        key={rec.id} 
                        onClick={() => toggleSelectRecorrencia(rec.id)}
                        className={`cursor-pointer transition-colors ${isSel ? 'bg-purple-50/60' : 'hover:bg-black/[0.02]'}`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => {}}
                            className="rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4"
                          />
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-ink-primary block">{rec.descricao}</span>
                          <span className="text-[10px] text-ink-muted">{rec.pessoaNome}</span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">{formatCurrency(rec.valorBrutoCentavos)}</td>
                        <td className="p-3 text-right font-mono font-bold text-purple-700 bg-purple-50/40">
                          {formatCurrency(novoValCentavos)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-purple-800 bg-purple-50/40">
                          +{formatCurrency(diffCentavos)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-black/5">
            <button
              type="submit"
              disabled={selectedRecorrenciaIds.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-40"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Aplicar Reajuste em Lote ({selectedRecorrenciaIds.length})</span>
            </button>
          </div>
        </form>
      )}

      {/* MODAL: CONFIRMAÇÃO DE GERAÇÃO RETROATIVA (REGRA DE OURO 4) */}
      <AnimatePresence>
        {modalSimulacaoOpen && simulacaoData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-black/10 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <Zap className="w-5 h-5 fill-amber-500" />
                  <h3 className="text-base font-bold text-ink-primary">Confirmação Prévia de Geração</h3>
                </div>
                <button onClick={() => setModalSimulacaoOpen(false)} className="text-ink-muted hover:text-ink-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <span className="font-bold block">Resumo do Lançamento em Massa:</span>
                <p>
                  Serão gerados <strong>{simulacaoData.totalTitulos} títulos regulares</strong> no sistema, totalizando{' '}
                  <strong className="text-brand font-mono">{formatCurrency(simulacaoData.valorTotalCentavos)}</strong>.
                </p>
                <p className="text-[11px] text-amber-700">
                  Idempotência: Títulos já gerados no mesmo período serão pulados automaticamente.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-primary block">
                  Prévia das Ocorrências a Criar ({simulacaoData.ocorrencias.length})
                </span>

                <div className="border border-black/10 rounded-xl overflow-hidden text-xs max-h-48 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                        <th className="p-2">Descrição</th>
                        <th className="p-2 text-center">Vencimento</th>
                        <th className="p-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 font-medium">
                      {simulacaoData.ocorrencias.map((oc, i) => (
                        <tr key={i} className="hover:bg-black/5">
                          <td className="p-2">
                            <span className="font-bold text-ink-primary block">{oc.descricao}</span>
                            <span className="text-[10px] text-ink-muted">{oc.pessoaNome}</span>
                          </td>
                          <td className="p-2 text-center font-mono">{oc.dataVencimento.split('-').reverse().join('/')}</td>
                          <td className="p-2 text-right font-mono font-bold text-ink-primary">
                            {formatCurrency(oc.valorCentavos)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => setModalSimulacaoOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={executandoGerador}
                  onClick={handleConfirmarGeracaoRetroativa}
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  <span>{executandoGerador ? 'Gerando...' : 'Confirmar e Criar Títulos'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/*
 * Módulo desativado a pedido: não está em uso no momento.
 * O componente RecorrenciasPage acima permanece intacto — para reativar, devolva o
 * `export default` a ele e remova `inativo: true` em src/data/departments.ts.
 */
export default function Page() {
  return <ModuloDesativado nome="Recorrências" />;
}
