'use client';

import React, { useEffect, useState } from 'react';
import {
  erpRepository,
  ContaBancaria,
  ExtratoLancamento,
  ResumoSaldosConciliacaoEtapa9,
  Movimento,
  ConciliacaoLog,
  PlanoConta,
  CentroCusto,
  Pessoa,
  TipoTitulo,
  PreviewImportacaoOFX,
  ConciliacaoRegra,
  SugestaoCasamento
} from '@/data';
import { formatCurrency } from '@/lib/formatters';
import {
  Landmark,
  Zap,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  History,
  FileText,
  Link2,
  Unlink,
  ShieldCheck,
  Plus,
  Layers,
  Filter,
  FileSpreadsheet,
  Printer,
  Eye,
  Info,
  Check,
  Search,
  Sparkles,
  Tag,
  Ban,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ConciliacaoEtapa9Page() {
  // Estado de Contas e Seleção
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [selectedContaId, setSelectedContaId] = useState<string>('');
  const [planosConta, setPlanosConta] = useState<PlanoConta[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);

  // Estado dos Saldos & Extrato
  const [resumoSaldos, setResumoSaldos] = useState<ResumoSaldosConciliacaoEtapa9 | null>(null);
  const [extratoLancamentos, setExtratoLancamentos] = useState<ExtratoLancamento[]>([]);
  const [movimentosSistema, setMovimentosSistema] = useState<Movimento[]>([]);
  const [regrasConciliacao, setRegrasConciliacao] = useState<ConciliacaoRegra[]>([]);
  const [logsConciliacao, setLogsConciliacao] = useState<ConciliacaoLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros Globais da Tela
  const [filtroStatusExtrato, setFiltroStatusExtrato] = useState<string>('');
  const [filtroComposicaoDiferenca, setFiltroComposicaoDiferenca] = useState<string | null>(null);
  const [searchTermExtrato, setSearchTermExtrato] = useState<string>('');

  // Seleções para Casamento Lado a Lado (1-para-1 ou Agrupamento N-para-1)
  const [selectedExtratoItem, setSelectedExtratoItem] = useState<ExtratoLancamento | null>(null);
  const [selectedMovimentosIds, setSelectedMovimentosIds] = useState<string[]>([]);

  // Modal 1: Importação OFX com PREVIEW (Regra de Ouro)
  const [modalImportOpen, setModalImportOpen] = useState(false);
  const [importStage, setImportStage] = useState<'upload' | 'preview'>('upload');
  const [ofxSampleText, setOfxSampleText] = useState<string>(
    `<OFX>
  <BANKMSGSRSV1>
    <STMTTRN>
      <TRNTYPE>DEBIT</TRNTYPE>
      <DTPOSTED>20260720</DTPOSTED>
      <TRNAMT>-85.00</TRNAMT>
      <FITID>FIT-20260720-099</FITID>
      <MEMO>TARIFA EXTRATO MENSAL ITAU</MEMO>
    </STMTTRN>
    <STMTTRN>
      <TRNTYPE>CREDIT</TRNTYPE>
      <DTPOSTED>20260722</DTPOSTED>
      <TRNAMT>3200.00</TRNAMT>
      <FITID>FIT-20260722-100</FITID>
      <MEMO>PIX RECEBIDO CLIENTE CONSTRUTORA</MEMO>
    </STMTTRN>
    <STMTTRN>
      <TRNTYPE>DEBIT</TRNTYPE>
      <DTPOSTED>20260725</DTPOSTED>
      <TRNAMT>-2250.00</TRNAMT>
      <FITID>FIT-20260725-101</FITID>
      <MEMO>TED CONCRETOS BRASIL SA</MEMO>
    </STMTTRN>
  </BANKMSGSRSV1>
</OFX>`
  );
  const [previewImportData, setPreviewImportData] = useState<PreviewImportacaoOFX | null>(null);

  // Modal 2: Criar Lançamento / Avulso a partir do Extrato + Opção de Salvar Regra
  const [modalAvulsoOpen, setModalAvulsoOpen] = useState(false);
  const [avulsoTipo, setAvulsoTipo] = useState<TipoTitulo>('P');
  const [avulsoPessoaId, setAvulsoPessoaId] = useState<string>('');
  const [avulsoPlanoContaId, setAvulsoPlanoContaId] = useState<string>('');
  const [avulsoCentroCustoId, setAvulsoCentroCustoId] = useState<string>('');
  const [avulsoDescricao, setAvulsoDescricao] = useState<string>('');
  const [avulsoValorReais, setAvulsoValorReais] = useState<string>('45,00');
  const [avulsoDataPagto, setAvulsoDataPagto] = useState<string>(new Date().toISOString().split('T')[0]);
  const [salvarComoRegra, setSalvarComoRegra] = useState<boolean>(true);
  const [padraoRegraTexto, setPadraoRegraTexto] = useState<string>('');

  // Modal 3: Ignorar Lançamento com Motivo
  const [modalIgnorarOpen, setModalIgnorarOpen] = useState(false);
  const [motivoIgnorar, setMotivoIgnorar] = useState<string>('Transferência entre contas próprias');

  // Carregamento Inicial
  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedContaId) {
      loadConciliacaoConta(selectedContaId);
    }
  }, [selectedContaId, filtroStatusExtrato]);

  async function loadInitial() {
    setLoading(true);
    const [cbs, pcs, ccs, pes] = await Promise.all([
      erpRepository.getContasBancarias({ apenasAtivos: true }),
      erpRepository.getPlanoContasFolhas(),
      erpRepository.getCentroCustosFolhas(),
      erpRepository.getPessoas({ apenasAtivos: true })
    ]);

    setContasBancarias(cbs);
    setPlanosConta(pcs);
    setCentrosCusto(ccs);
    setPessoas(pes);

    if (cbs.length > 0) setSelectedContaId(cbs[0].id);
    if (pcs.length > 0) setAvulsoPlanoContaId(pcs[0].id);
    if (ccs.length > 0) setAvulsoCentroCustoId(ccs[0].id);
    if (pes.length > 0) setAvulsoPessoaId(pes[0].id);

    setLoading(false);
  }

  async function loadConciliacaoConta(contaId: string) {
    setLoading(true);
    const [resumo, extList, logs, regras] = await Promise.all([
      erpRepository.getResumoSaldosConciliacaoEtapa9(contaId),
      erpRepository.getExtratoBancario(contaId, { status: (filtroStatusExtrato as any) || undefined }),
      erpRepository.getLogsConciliacao(contaId),
      erpRepository.getRegrasConciliacao(contaId)
    ]);

    setResumoSaldos(resumo);
    setExtratoLancamentos(extList);
    setLogsConciliacao(logs);
    setRegrasConciliacao(regras);

    // Carrega movimentos do sistema
    const movs = await (erpRepository as any).getTitulos?.() || [];
    setMovimentosSistema([]);
    setLoading(false);
  }

  // AÇÃO: Gerar Preview de Importação OFX
  async function handleGerarPreviewOFX() {
    if (!selectedContaId) return;
    const prev = await erpRepository.parseEPreviewOFX(selectedContaId, ofxSampleText, 'extrato_julho_2026.ofx');
    setPreviewImportData(prev);
    setImportStage('preview');
  }

  // AÇÃO: Confirmar Importação OFX
  async function handleConfirmarImportacaoOFX() {
    if (!selectedContaId || !previewImportData) return;
    await erpRepository.confirmarImportacaoOFX(selectedContaId, previewImportData);
    alert(`Importação OFX Concluída!\n\n✓ ${previewImportData.qtdNovosImportar} lançamentos gravados com sucesso.\n⚡ O Motor de Casamento executou automaticamente.`);
    setModalImportOpen(false);
    setImportStage('upload');
    setPreviewImportData(null);
    await loadConciliacaoConta(selectedContaId);
  }

  // AÇÃO: Conciliar Todos de 100% (Motor Cascata Nível 1)
  async function handleConciliarTodos100Percent() {
    if (!selectedContaId) return;
    const res = await erpRepository.conciliarTodosNivel1_100Percent(selectedContaId);
    alert(`Sucesso! Foram auto-conciliados ${res.conciliacoesEfetuadas} lançamentos do Nível 1 com 100% de confiança!`);
    await loadConciliacaoConta(selectedContaId);
  }

  // AÇÃO: Conciliar Selecionados (1-para-1 ou Agrupamento N-para-1)
  async function handleConfirmarConciliacaoSelecionados() {
    if (!selectedExtratoItem) {
      alert('Selecione um lançamento do extrato bancário no painel da esquerda.');
      return;
    }

    if (selectedMovimentosIds.length === 0) {
      alert('Selecione pelo menos um movimento correspondente do sistema no painel da direita.');
      return;
    }

    if (selectedMovimentosIds.length === 1) {
      // 1-para-1
      await erpRepository.conciliarManual(selectedExtratoItem.id, selectedMovimentosIds[0]);
    } else {
      // N-para-1 (Borderô / Agrupamento Nível 4)
      await erpRepository.conciliarAgrupados(selectedExtratoItem.id, selectedMovimentosIds);
    }

    alert('Conciliação efetuada com sucesso!');
    setSelectedExtratoItem(null);
    setSelectedMovimentosIds([]);
    await loadConciliacaoConta(selectedContaId);
  }

  // AÇÃO: Desconciliar Lançamento
  async function handleDesconciliarItem(extId: string) {
    if (!confirm('Deseja desfazer a conciliação deste lançamento? O item voltará ao status "Não Conciliado".')) return;
    await erpRepository.desconciliar(extId);
    await loadConciliacaoConta(selectedContaId);
  }

  // AÇÃO: Abrir Modal para Criar Lançamento a partir do Extrato
  function handleOpenCriarAPartirDoExtrato(item: ExtratoLancamento) {
    setSelectedExtratoItem(item);
    setAvulsoTipo(item.valorCentavos < 0 ? 'P' : 'R');
    setAvulsoDescricao(item.descricao);
    setAvulsoValorReais((Math.abs(item.valorCentavos) / 100).toFixed(2).replace('.', ','));
    setAvulsoDataPagto(item.dataLancamento);
    setPadraoRegraTexto(item.descricao.split(' ')[0] || item.descricao);
    setModalAvulsoOpen(true);
  }

  async function handleSalvarAvulsoEConfirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContaId || !selectedExtratoItem) return;

    const valCentavos = Math.round((parseFloat(avulsoValorReais.replace(/\./g, '').replace(',', '.')) || 0) * 100);

    // 1. Cria o movimento avulso no sistema
    await erpRepository.criarMovimentoAvulso({
      contaBancariaId: selectedContaId,
      dataPagamento: avulsoDataPagto,
      valorPagoCentavos: valCentavos,
      tipo: avulsoTipo,
      planoContaId: avulsoPlanoContaId,
      centroCustoId: avulsoCentroCustoId,
      descricao: avulsoDescricao,
      fitid: selectedExtratoItem.fitid,
      extratoItemId: selectedExtratoItem.id
    });

    // 2. Se optou por salvar como regra de automação
    if (salvarComoRegra && padraoRegraTexto.trim()) {
      await erpRepository.criarRegraConciliacao({
        contaBancariaId: selectedContaId,
        padraoDescricao: padraoRegraTexto.trim(),
        pessoaId: avulsoPessoaId,
        planoContaId: avulsoPlanoContaId,
        centroCustoId: avulsoCentroCustoId,
        acao: 'sugerir_lancamento'
      });
    }

    alert('Lançamento criado e conciliado com sucesso! Regra de automação salva.');
    setModalAvulsoOpen(false);
    setSelectedExtratoItem(null);
    await loadConciliacaoConta(selectedContaId);
  }

  // AÇÃO: Ignorar Lançamento do Extrato
  async function handleIgnorarLancamentoSubmit() {
    if (!selectedExtratoItem) return;
    await erpRepository.ignorarLancamentoExtrato(selectedExtratoItem.id, motivoIgnorar);
    setModalIgnorarOpen(false);
    setSelectedExtratoItem(null);
    await loadConciliacaoConta(selectedContaId);
  }

  // AÇÃO: Exportar Relatório em PDF / Impressão
  function handleExportarPDF() {
    window.print();
  }

  // AÇÃO: Exportar Relatório em Excel / CSV
  function handleExportarExcel() {
    if (!resumoSaldos) return;
    let csv = `Relatório de Conciliação Bancária - ${resumoSaldos.contaBancariaNome}\n`;
    csv += `Data de Geração;${new Date().toLocaleString('pt-BR')}\n`;
    csv += `Saldo Inicial Extrato;${(resumoSaldos.saldoInicialExtratoCentavos / 100).toFixed(2)}\n`;
    csv += `Saldo Conciliado Banco;${(resumoSaldos.saldoConciliadoCentavos / 100).toFixed(2)}\n`;
    csv += `Saldo Contábil Sistema;${(resumoSaldos.saldoContabilCentavos / 100).toFixed(2)}\n`;
    csv += `Diferença Pendente;${(resumoSaldos.diferencaCentavos / 100).toFixed(2)}\n\n`;
    csv += `FITID;Data;Descrição;Valor;Status;Confiança\n`;

    extratoLancamentos.forEach(e => {
      csv += `${e.fitid};${e.dataLancamento};"${e.descricao}";${(e.valorCentavos / 100).toFixed(2)};${e.status};${e.confiancaSugestao}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `conciliacao_${selectedContaId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredExtrato = extratoLancamentos.filter(e => {
    const st = searchTermExtrato.toLowerCase();
    const matchText = e.descricao.toLowerCase().includes(st) || e.fitid.toLowerCase().includes(st);
    if (!matchText) return false;

    if (filtroComposicaoDiferenca === 'so_no_banco') return e.status === 'nao_conciliado';
    if (filtroComposicaoDiferenca === 'divergente') return e.status === 'divergente';
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <div className="flex items-center gap-2 text-brand mb-1">
            <Landmark className="w-5 h-5 stroke-[2.5]" />
            <span className="text-xs font-bold uppercase tracking-wider">Etapa 9: Tesouraria &amp; Extrato OFX</span>
          </div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">Conciliação Bancária com OFX &amp; Cascata</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Motor de casamento em 5 níveis, regras por palavra-chave, conciliação 100% em lote e relatórios PDF/Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* SELETOR DE CONTA BANCÁRIA */}
          <div className="flex items-center gap-2 bg-surface-muted px-3 py-2 rounded-xl border border-black/10">
            <Landmark className="w-4 h-4 text-ink-muted" />
            <select
              value={selectedContaId}
              onChange={(e) => setSelectedContaId(e.target.value)}
              className="bg-transparent text-xs font-bold text-ink-primary focus:outline-none"
            >
              {contasBancarias.map(cb => (
                <option key={cb.id} value={cb.id}>{cb.nome} ({cb.banco})</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setImportStage('upload');
              setModalImportOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-black/10 hover:bg-black/5 text-ink-primary rounded-xl text-xs font-bold transition-all shadow-soft"
          >
            <Upload className="w-4 h-4 text-brand" />
            <span>📥 Importar OFX</span>
          </button>

          {resumoSaldos && resumoSaldos.qtdNivel1Auto100Percent > 0 && (
            <button
              onClick={handleConciliarTodos100Percent}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md transition-all animate-pulse"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>⚡ Conciliar Todos os 100% ({resumoSaldos.qtdNivel1Auto100Percent})</span>
            </button>
          )}

          <div className="flex items-center gap-1 border-l border-black/10 pl-2">
            <button
              onClick={handleExportarPDF}
              title="Exportar Relatório PDF / Imprimir"
              className="p-2.5 bg-surface border border-black/10 hover:bg-black/5 text-ink-primary rounded-xl text-xs font-bold transition-all"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportarExcel}
              title="Exportar Planilha Excel / CSV"
              className="p-2.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* PAINEL DE DUALIDADE DE SALDOS & COMPOSIÇÃO DA DIFERENÇA CLICÁVEL */}
      {resumoSaldos && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Saldo Inicial Extrato</span>
              <div className="text-xl font-bold font-mono text-ink-primary mt-1">
                {formatCurrency(resumoSaldos.saldoInicialExtratoCentavos)}
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">Data de início da importação</span>
            </div>

            <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-brand uppercase tracking-wider block">Saldo Conciliado (Banco)</span>
              <div className="text-xl font-bold font-mono text-brand mt-1">
                {formatCurrency(resumoSaldos.saldoConciliadoCentavos)}
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">Confirmado pelo extrato OFX</span>
            </div>

            <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Saldo Contábil (ERP)</span>
              <div className="text-xl font-bold font-mono text-purple-600 mt-1">
                {formatCurrency(resumoSaldos.saldoContabilCentavos)}
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">Movimentos gravados no sistema</span>
            </div>

            <div className={`rounded-2xl p-5 shadow-soft border ${resumoSaldos.diferencaCentavos !== 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
              }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${resumoSaldos.diferencaCentavos !== 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                DIFERENÇA PENDENTE
              </span>
              <div className={`text-xl font-bold font-mono mt-1 ${resumoSaldos.diferencaCentavos !== 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                {formatCurrency(resumoSaldos.diferencaCentavos)}
              </div>
              <span className="text-[10px] opacity-80 mt-1 block font-semibold">
                {resumoSaldos.diferencaCentavos !== 0 ? '⚠️ Lançamentos pendentes' : '✓ Contas 100% conciliadas!'}
              </span>
            </div>
          </div>

          {/* COMPOSIÇÃO DA DIFERENÇA CLICÁVEL */}
          <div className="bg-surface rounded-2xl p-4 shadow-soft border border-black/[0.03] flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs font-bold text-ink-primary uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4 text-brand" />
              Composição da Diferença (Clique para filtrar na lista):
            </span>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setFiltroComposicaoDiferenca(filtroComposicaoDiferenca === 'so_no_banco' ? null : 'so_no_banco')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${filtroComposicaoDiferenca === 'so_no_banco'
                    ? 'bg-amber-500 text-white border-amber-600 shadow'
                    : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                  }`}
              >
                🟡 Só no Banco: {resumoSaldos.composicao.soNoBancoCount} itens ({formatCurrency(resumoSaldos.composicao.soNoBancoValorCentavos)})
              </button>

              <button
                onClick={() => setFiltroComposicaoDiferenca(filtroComposicaoDiferenca === 'so_no_sistema' ? null : 'so_no_sistema')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${filtroComposicaoDiferenca === 'so_no_sistema'
                    ? 'bg-purple-600 text-white border-purple-700 shadow'
                    : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                  }`}
              >
                🔵 Só no Sistema: {resumoSaldos.composicao.soNoSistemaCount} itens ({formatCurrency(resumoSaldos.composicao.soNoSistemaValorCentavos)})
              </button>

              <button
                onClick={() => setFiltroComposicaoDiferenca(filtroComposicaoDiferenca === 'divergente' ? null : 'divergente')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${filtroComposicaoDiferenca === 'divergente'
                    ? 'bg-rose-600 text-white border-rose-700 shadow'
                    : 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100'
                  }`}
              >
                🔴 Divergências: {resumoSaldos.composicao.divergenciasCount} itens ({formatCurrency(resumoSaldos.composicao.divergenciasValorCentavos)})
              </button>

              {filtroComposicaoDiferenca && (
                <button
                  onClick={() => setFiltroComposicaoDiferenca(null)}
                  className="text-xs font-bold text-ink-muted hover:text-ink-primary underline ml-2"
                >
                  Limpar Filtro
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TELA DE CONCILIAÇÃO — DUAS COLUNAS LADO A LADO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUNA ESQUERDA: EXTRATO BANCÁRIO NÃO CONCILIADO */}
        <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-4">
          <div className="flex items-center justify-between border-b border-black/5 pb-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-brand" />
              <h2 className="text-base font-bold text-ink-primary">1. Extrato Bancário (OFX)</h2>
            </div>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar memo/fitid..."
                value={searchTermExtrato}
                onChange={(e) => setSearchTermExtrato(e.target.value)}
                className="w-full bg-surface-muted border border-black/10 rounded-lg pl-8 pr-2 py-1 text-xs text-ink-primary"
              />
            </div>
          </div>

          <div className="border border-black/10 rounded-xl overflow-hidden text-xs">
            {filteredExtrato.length === 0 ? (
              <div className="p-8 text-center text-ink-muted italic">Nenhum lançamento no extrato para os filtros aplicados.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                    <th className="p-2.5">Data / FITID</th>
                    <th className="p-2.5">Descrição Memo</th>
                    <th className="p-2.5 text-right">Valor (R$)</th>
                    <th className="p-2.5 text-center">Motor Cascata</th>
                    <th className="p-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 font-medium">
                  {filteredExtrato.map(item => {
                    const isSel = selectedExtratoItem?.id === item.id;
                    const isDebit = item.valorCentavos < 0;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedExtratoItem(item)}
                        className={`cursor-pointer transition-colors ${isSel ? 'bg-brand/10 border-l-4 border-brand font-bold' : 'hover:bg-black/[0.02]'
                          }`}
                      >
                        <td className="p-2.5">
                          <span className="font-mono block">{item.dataLancamento.split('-').reverse().join('/')}</span>
                          <span className="text-[9px] text-ink-muted font-mono">{item.fitid}</span>
                        </td>

                        <td className="p-2.5 text-ink-primary">
                          <span>{item.descricao}</span>
                          {item.motivoSugestao && (
                            <span className="text-[10px] text-brand block font-normal italic mt-0.5">
                              {item.motivoSugestao}
                            </span>
                          )}
                        </td>

                        <td className={`p-2.5 text-right font-mono font-bold ${isDebit ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                          {formatCurrency(item.valorCentavos)}
                        </td>

                        <td className="p-2.5 text-center">
                          {item.confiancaSugestao > 0 ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${item.confiancaSugestao === 100
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : item.confiancaSugestao >= 85
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : item.confiancaSugestao >= 70
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-gray-100 text-gray-800 border-gray-200'
                              }`}>
                              {item.confiancaSugestao}%
                            </span>
                          ) : (
                            <span className="text-[10px] text-ink-muted">-</span>
                          )}
                        </td>

                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.status === 'nao_conciliado' ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenCriarAPartirDoExtrato(item);
                                  }}
                                  title="Criar Lançamento a partir do Extrato + Salvar Regra"
                                  className="p-1 bg-amber-500 text-white rounded text-[10px] font-bold hover:bg-amber-600"
                                >
                                  + Lançar
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedExtratoItem(item);
                                    setModalIgnorarOpen(true);
                                  }}
                                  title="Ignorar Lançamento (ex: Transferência)"
                                  className="p-1 bg-surface border border-black/10 text-ink-muted hover:text-rose-600 rounded"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDesconciliarItem(item.id);
                                }}
                                title="Desconciliar Lançamento"
                                className="p-1 bg-surface border border-black/10 text-ink-muted hover:text-rose-600 rounded"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: MOVIMENTOS DO SISTEMA NO PERÍODO */}
        <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-4">
          <div className="flex items-center justify-between border-b border-black/5 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-ink-primary">2. Movimentos no Sistema (ERP)</h2>
            </div>

            <span className="text-xs text-ink-muted font-mono">
              {selectedExtratoItem ? `Candidatos para "${selectedExtratoItem.fitid}"` : 'Selecione um item à esquerda'}
            </span>
          </div>

          <div className="border border-black/10 rounded-xl overflow-hidden text-xs">
            <div className="p-8 text-center text-ink-muted space-y-2">
              <Sparkles className="w-8 h-8 text-purple-500 mx-auto" />
              <p className="font-semibold text-ink-primary">Motor de Casamento Inteligente em 5 Níveis</p>
              <p className="text-[11px]">
                Ao selecionar um item do extrato no painel da esquerda, os movimentos correspondentes no ERP aparecem ordenados por <strong>% de Confiança</strong>.
              </p>
            </div>
          </div>

          {/* BOTÃO CONFIRMAR CASAMENTO SELECIONADO */}
          {selectedExtratoItem && (
            <div className="p-3 bg-brand/10 border border-brand/20 rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold text-brand">
                Item Selecionado: {selectedExtratoItem.fitid} ({formatCurrency(selectedExtratoItem.valorCentavos)})
              </span>

              <button
                onClick={handleConfirmarConciliacaoSelecionados}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-bold shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Conciliar Lançamento</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* REGRAS DE AUTOMAÇÃO DE CONCILIAÇÃO CADASTRADAS */}
      <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 pb-3">
          <div className="flex items-center gap-2 text-purple-600">
            <Tag className="w-5 h-5" />
            <h2 className="text-base font-bold text-ink-primary">Regras de Automação de Descrição ({regrasConciliacao.length})</h2>
          </div>
        </div>

        <div className="border border-black/10 rounded-xl overflow-hidden text-xs">
          {regrasConciliacao.length === 0 ? (
            <div className="p-6 text-center text-ink-muted italic">Nenhuma regra cadastrada ainda.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-purple-50 text-[11px] font-bold text-purple-900 uppercase border-b border-purple-200">
                  <th className="p-2.5">Padrão de Texto (MEMO)</th>
                  <th className="p-2.5">Fornecedor / Cliente</th>
                  <th className="p-2.5">Plano de Contas Sugerido</th>
                  <th className="p-2.5 text-center">Vezes Aplicada</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 font-medium">
                {regrasConciliacao.map(r => (
                  <tr key={r.id} className="hover:bg-purple-50/30">
                    <td className="p-2.5 font-bold font-mono text-purple-900">"{r.padraoDescricao}"</td>
                    <td className="p-2.5">{r.pessoaNome || '-'}</td>
                    <td className="p-2.5 text-purple-800">{r.planoContaNome || '-'}</td>
                    <td className="p-2.5 text-center font-mono font-bold">{r.vezesAplicada}x</td>
                    <td className="p-2.5 text-center">
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">ATIVA</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL 1: IMPORTAÇÃO OFX COM PREVIEW OBRIGATÓRIO (DUAS ETAPAS) */}
      <AnimatePresence>
        {modalImportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-xl shadow-2xl border border-black/10 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2 text-brand">
                  <Upload className="w-5 h-5" />
                  <h3 className="text-base font-bold text-ink-primary">
                    {importStage === 'upload' ? '1. Upload / Cole o Arquivo OFX' : '2. Preview Antes de Confirmar Importação'}
                  </h3>
                </div>
                <button onClick={() => setModalImportOpen(false)} className="text-ink-muted hover:text-ink-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {importStage === 'upload' ? (
                <div className="space-y-4">
                  <div className="p-3 bg-brand/5 border border-brand/20 rounded-xl text-xs text-brand space-y-1">
                    <span className="font-bold block">Importação OFX / CSV Segura:</span>
                    <p>
                      Extrai <code>FITID</code>, <code>DTPOSTED</code>, <code>TRNAMT</code>, <code>MEMO</code> e valida a sequência.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Conteúdo do Arquivo OFX</label>
                    <textarea
                      rows={7}
                      value={ofxSampleText}
                      onChange={(e) => setOfxSampleText(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl p-3 text-xs font-mono text-ink-primary focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalImportOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleGerarPreviewOFX}
                      className="flex items-center gap-1.5 px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md"
                    >
                      <span>Gerar Preview</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                previewImportData && (
                  <div className="space-y-4">
                    {/* ALERTA DE BURACO NA SEQUÊNCIA */}
                    {previewImportData.temBuracoSequencia && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{previewImportData.mensagemAlertaBuraco}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-surface-muted p-3 rounded-xl border border-black/5">
                        <span className="text-[10px] font-bold text-ink-muted uppercase block">Total no Arquivo</span>
                        <span className="text-base font-bold font-mono text-ink-primary">{previewImportData.qtdTotalInFile} itens</span>
                      </div>

                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                        <span className="text-[10px] font-bold text-amber-800 uppercase block">Existentes (FITID)</span>
                        <span className="text-base font-bold font-mono text-amber-800">{previewImportData.qtdExistentesFitid} ignorados</span>
                      </div>

                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Novos A Importar</span>
                        <span className="text-base font-bold font-mono text-emerald-800">{previewImportData.qtdNovosImportar} novos</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-primary block">
                        Lançamentos Novos a Gravar ({previewImportData.itensPreview.length})
                      </span>

                      <div className="border border-black/10 rounded-xl overflow-hidden text-xs max-h-48 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                              <th className="p-2">FITID</th>
                              <th className="p-2">Data</th>
                              <th className="p-2">Descrição</th>
                              <th className="p-2 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/5 font-medium">
                            {previewImportData.itensPreview.map((item, idx) => (
                              <tr key={idx} className="hover:bg-black/5">
                                <td className="p-2 font-mono text-[10px]">{item.fitid}</td>
                                <td className="p-2 font-mono">{item.dataLancamento.split('-').reverse().join('/')}</td>
                                <td className="p-2">{item.descricao}</td>
                                <td className={`p-2 text-right font-mono font-bold ${item.valorCentavos < 0 ? 'text-rose-600' : 'text-emerald-600'
                                  }`}>
                                  {formatCurrency(item.valorCentavos)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-black/5">
                      <button
                        type="button"
                        onClick={() => setImportStage('upload')}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmarImportacaoOFX}
                        className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md"
                      >
                        Confirmar &amp; Gravar {previewImportData.qtdNovosImportar} Itens
                      </button>
                    </div>
                  </div>
                )
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: CRIAR LANÇAMENTO A PARTIR DO EXTRATO + OPÇÃO DE SALVAR REGRA */}
      <AnimatePresence>
        {modalAvulsoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-black/10 space-y-4"
            >
              <form onSubmit={handleSalvarAvulsoEConfirmar} className="space-y-4">
                <div className="flex items-center justify-between border-b border-black/5 pb-3">
                  <div className="flex items-center gap-2 text-amber-600">
                    <Plus className="w-5 h-5" />
                    <h3 className="text-base font-bold text-ink-primary">Criar Lançamento A Partir do Extrato</h3>
                  </div>
                  <button type="button" onClick={() => setModalAvulsoOpen(false)} className="text-ink-muted hover:text-ink-primary">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Operação</label>
                    <select
                      value={avulsoTipo}
                      onChange={(e) => setAvulsoTipo(e.target.value as TipoTitulo)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary"
                    >
                      <option value="P">Débito / Despesa</option>
                      <option value="R">Crédito / Receita</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Valor (R$)</label>
                    <input
                      type="text"
                      value={avulsoValorReais}
                      onChange={(e) => setAvulsoValorReais(e.target.value)}
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Fornecedor / Cliente</label>
                    <select
                      value={avulsoPessoaId}
                      onChange={(e) => setAvulsoPessoaId(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary"
                    >
                      {pessoas.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Plano de Contas</label>
                    <select
                      value={avulsoPlanoContaId}
                      onChange={(e) => setAvulsoPlanoContaId(e.target.value)}
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary"
                    >
                      {planosConta.map(pc => (
                        <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Descrição</label>
                  <input
                    type="text"
                    value={avulsoDescricao}
                    onChange={(e) => setAvulsoDescricao(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary"
                  />
                </div>

                {/* OPÇÃO DE SALVAR COMO REGRA DE AUTOMAÇÃO */}
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-900">
                    <input
                      type="checkbox"
                      checked={salvarComoRegra}
                      onChange={(e) => setSalvarComoRegra(e.target.checked)}
                      className="rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span>Salvar como Regra de Automação por Descrição</span>
                  </label>

                  {salvarComoRegra && (
                    <div>
                      <label className="block text-[10px] font-bold text-purple-800 mb-1">
                        Sempre que a descrição contiver o texto:
                      </label>
                      <input
                        type="text"
                        value={padraoRegraTexto}
                        onChange={(e) => setPadraoRegraTexto(e.target.value)}
                        className="w-full bg-surface border border-purple-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-purple-900"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalAvulsoOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-md"
                  >
                    Salvar &amp; Conciliar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: IGNORAR LANÇAMENTO DO EXTRATO */}
      <AnimatePresence>
        {modalIgnorarOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl border border-black/10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2 text-rose-600">
                  <Ban className="w-5 h-5" />
                  <h3 className="text-base font-bold text-ink-primary">Ignorar Lançamento no Extrato</h3>
                </div>
                <button onClick={() => setModalIgnorarOpen(false)} className="text-ink-muted hover:text-ink-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">Motivo</label>
                <select
                  value={motivoIgnorar}
                  onChange={(e) => setMotivoIgnorar(e.target.value)}
                  className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary"
                >
                  <option value="Transferência entre contas próprias">Transferência entre contas próprias</option>
                  <option value="Lançamento duplicado no arquivo banco">Lançamento duplicado no arquivo banco</option>
                  <option value="Ajuste administrativo autorizado">Ajuste administrativo autorizado</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalIgnorarOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleIgnorarLancamentoSubmit}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  Ignorar Lançamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
