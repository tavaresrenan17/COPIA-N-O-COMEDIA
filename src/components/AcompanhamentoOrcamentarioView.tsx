'use client';

import React, { useEffect, useState } from 'react';
import { 
  erpRepository, 
  Orcamento, 
  OrcamentoExecucaoView 
} from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { 
  TrendingUp, 
  Calendar, 
  Download, 
  Printer, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Building2, 
  Info,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { useToast } from '@/components/ui/ToastProvider';

export function AcompanhamentoOrcamentarioView() {
  const toast = useToast();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [selectedOrcamentoId, setSelectedOrcamentoId] = useState<string>('');
  const [dataCorte, setDataCorte] = useState<string>(new Date().toISOString().split('T')[0]);
  const [execucaoData, setExecucaoData] = useState<OrcamentoExecucaoView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [compararV1, setCompararV1] = useState<boolean>(false);

  useEffect(() => {
    loadOrcamentos();
  }, []);

  useEffect(() => {
    if (selectedOrcamentoId) {
      loadExecucaoData(selectedOrcamentoId, dataCorte);
    }
  }, [selectedOrcamentoId, dataCorte]);

  async function loadOrcamentos() {
    const list = await erpRepository.getOrcamentos();
    setOrcamentos(list);
    if (list.length > 0) {
      const apr = list.find(o => o.status === 'aprovado') || list[0];
      setSelectedOrcamentoId(apr.id);
    } else {
      setLoading(false);
    }
  }

  async function loadExecucaoData(orcId: string, corte: string) {
    setLoading(true);
    try {
      const exec = await erpRepository.getOrcamentoExecucao(orcId, corte);
      setExecucaoData(exec);
    } catch (err) {
      toast.error('Erro ao carregar a execução orçamentária', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
    setLoading(false);
  }

  function toggleRowExpand(planoId: string) {
    setExpandedRows(prev => ({ ...prev, [planoId]: !prev[planoId] }));
  }

  function handleExportarCSV() {
    if (!execucaoData) return;

    let csv = `RELATÓRIO DE ACOMPANHAMENTO ORÇAMENTÁRIO\n`;
    csv += `Obra / Centro de Custo;${execucaoData.centroCustoCodigo} - ${execucaoData.centroCustoNome}\n`;
    csv += `Orçamento ID;${execucaoData.orcamentoId};Versão;v${execucaoData.versao};Status;${execucaoData.status}\n`;
    csv += `Período;${execucaoData.dataInicio} a ${execucaoData.dataFim};Data de Corte;${execucaoData.dataCorte}\n\n`;

    csv += `Código;Plano Financeiro Nível 2;Orçado (R$);Comprometido (R$);Realizado (R$);Saldo (R$);% Consumido;Status\n`;

    execucaoData.itensExecucao.forEach(it => {
      const o = (it.orcadoCentavos / 100).toFixed(2).replace('.', ',');
      const c = (it.comprometidoCentavos / 100).toFixed(2).replace('.', ',');
      const r = (it.realizadoCentavos / 100).toFixed(2).replace('.', ',');
      const s = (it.saldoCentavos / 100).toFixed(2).replace('.', ',');
      const pct = it.percentualConsumido.toFixed(1) + '%';
      const st = it.isEstourado ? 'ESTOURADO' : 'OK';

      csv += `${it.planoContaNivel2Codigo};${it.planoContaNivel2Nome};${o};${c};${r};${s};${pct};${st}\n`;
    });

    csv += `\nTOTAIS;CONSOLIDADOS;${(execucaoData.totalOrcadoCentavos/100).toFixed(2).replace('.', ',')};${(execucaoData.totalComprometidoCentavos/100).toFixed(2).replace('.', ',')};${(execucaoData.totalRealizadoCentavos/100).toFixed(2).replace('.', ',')};${(execucaoData.totalSaldoCentavos/100).toFixed(2).replace('.', ',')};${execucaoData.totalPercentualConsumido.toFixed(1)}%\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acompanhamento_orcamento_${execucaoData.centroCustoCodigo}_v${execucaoData.versao}.csv`;
    a.click();
  }

  function handleImprimirPDF() {
    window.print();
  }

  function getSemaforoColor(pct: number) {
    if (pct > 100) return 'bg-rose-500 text-rose-700 border-rose-300';
    if (pct >= 80) return 'bg-amber-500 text-amber-700 border-amber-300';
    return 'bg-emerald-500 text-emerald-700 border-emerald-300';
  }

  function getSemaforoBadge(pct: number) {
    if (pct > 100) return <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">🔴 Estourado</span>;
    if (pct >= 80) return <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">🟡 Alerta (&gt;80%)</span>;
    return <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">🟢 Normal</span>;
  }

  return (
    <div className="space-y-6 print:p-0 print:space-y-4">
      {/* CONTROLES DO PAINEL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-muted px-3 py-2 rounded-xl border border-black/10">
            <Building2 className="w-4 h-4 text-ink-muted" />
            <select
              value={selectedOrcamentoId}
              onChange={(e) => setSelectedOrcamentoId(e.target.value)}
              className="bg-transparent text-xs font-bold text-ink-primary focus:outline-none"
            >
              {orcamentos.map(o => (
                <option key={o.id} value={o.id}>
                  {o.centroCustoCodigo} - {o.nome} (v{o.versao}) {o.status === 'aprovado' ? '★ Aprovado' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-surface-muted px-3 py-2 rounded-xl border border-black/10">
            <Calendar className="w-4 h-4 text-ink-muted" />
            <span className="text-[11px] text-ink-muted font-medium">Corte:</span>
            <input
              type="date"
              value={dataCorte}
              onChange={(e) => setDataCorte(e.target.value)}
              className="bg-transparent text-xs font-bold text-ink-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportarCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-black/10 text-ink-primary hover:bg-black/5 rounded-xl text-xs font-bold shadow-soft transition-all"
          >
            <Download className="w-4 h-4 text-brand" />
            <span>Excel (CSV)</span>
          </button>

          <button
            onClick={handleImprimirPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand text-white hover:bg-brand-hover rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-ink-muted animate-pulse">Carregando acompanhamento orçamentário...</div>
      ) : !execucaoData ? (
        <div className="p-12 text-center text-ink-muted">Nenhum dado orçamentário encontrado.</div>
      ) : (
        <>
          {/* CARDS KPI (5 BLOCOS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-surface rounded-2xl p-4 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">1. Orçado Total</span>
              <div className="text-xl font-bold font-mono text-ink-primary mt-1">
                {formatCurrency(execucaoData.totalOrcadoCentavos)}
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">Planejado v{execucaoData.versao}</span>
            </div>

            <div className="bg-surface rounded-2xl p-4 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">2. Comprometido</span>
              <div className="text-xl font-bold font-mono text-amber-600 mt-1">
                {formatCurrency(execucaoData.totalComprometidoCentavos)}
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">Títulos pendentes em aberto</span>
            </div>

            <div className="bg-surface rounded-2xl p-4 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">3. Realizado (Caixa)</span>
              <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
                {formatCurrency(execucaoData.totalRealizadoCentavos)}
              </div>
              <span className="text-[10px] text-ink-muted mt-1 block">Pagamentos efetivados</span>
            </div>

            <div className={`rounded-2xl p-4 shadow-soft border transition-all ${
              execucaoData.totalSaldoCentavos < 0 
                ? 'bg-rose-500 text-white border-rose-600' 
                : 'bg-surface text-ink-primary border-black/[0.04]'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                execucaoData.totalSaldoCentavos < 0 ? 'text-white/80' : 'text-brand'
              }`}>
                4. Saldo Disponível
              </span>
              <div className="text-xl font-bold font-mono mt-1">
                {formatCurrency(execucaoData.totalSaldoCentavos)}
              </div>
              <span className={`text-[10px] mt-1 block ${
                execucaoData.totalSaldoCentavos < 0 ? 'text-white/90 font-bold' : 'text-ink-muted'
              }`}>
                {execucaoData.totalSaldoCentavos < 0 ? '⚠️ Orçamento Estourado!' : 'Orçado - Consumido'}
              </span>
            </div>

            <div className="bg-surface rounded-2xl p-4 shadow-soft border border-black/[0.04]">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">5. % Consumido</span>
              <div className="text-xl font-bold font-mono text-ink-primary mt-1">
                {execucaoData.totalPercentualConsumido.toFixed(1)}%
              </div>
              <div className="w-full bg-black/5 rounded-full h-2 mt-2 overflow-hidden">
                <div 
                  className={`h-full transition-all ${getSemaforoColor(execucaoData.totalPercentualConsumido)}`}
                  style={{ width: `${Math.min(100, execucaoData.totalPercentualConsumido)}%` }}
                />
              </div>
            </div>
          </div>

          {/* TABELA DE ACOMPANHAMENTO */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-4 rounded-2xl shadow-soft border border-black/[0.03]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                Acompanhamento por Grupo (Nível 2 do Plano Financeiro)
              </span>
              <span className="text-xs text-ink-muted">
                • Clique na linha para ver os títulos e movimentações detalhadas
              </span>
            </div>

            {execucaoData.temLinhaBaseV1 && (
              <label className="flex items-center gap-2 text-xs font-bold text-brand cursor-pointer bg-brand/5 px-3 py-1.5 rounded-xl border border-brand/20">
                <input
                  type="checkbox"
                  checked={compararV1}
                  onChange={(e) => setCompararV1(e.target.checked)}
                  className="rounded border-black/20 text-brand focus:ring-brand"
                />
                <span>Comparar com a Linha Base (v1)</span>
              </label>
            )}
          </div>

          <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.03] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                    <th className="py-3 px-4 w-10"></th>
                    <th className="py-3 px-4">Plano Financeiro Nível 2</th>
                    <th className="py-3 px-4 text-right">Orçado (R$)</th>
                    {compararV1 && (
                      <>
                        <th className="py-3 px-4 text-right bg-purple-50 text-purple-700">Orçado v1</th>
                        <th className="py-3 px-4 text-right bg-purple-50 text-purple-700">Variação R$</th>
                        <th className="py-3 px-4 text-right bg-purple-50 text-purple-700">Variação %</th>
                      </>
                    )}
                    <th className="py-3 px-4 text-right text-amber-600">Comprometido</th>
                    <th className="py-3 px-4 text-right text-emerald-600">Realizado</th>
                    <th className="py-3 px-4 text-right">Saldo (R$)</th>
                    <th className="py-3 px-4 text-center min-w-[140px]">% Consumido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 font-medium">
                  {execucaoData.itensExecucao.map((it) => {
                    const isExpanded = !!expandedRows[it.planoContaNivel2Id];

                    return (
                      <React.Fragment key={it.planoContaNivel2Id}>
                        <tr 
                          onClick={() => toggleRowExpand(it.planoContaNivel2Id)}
                          className={`cursor-pointer transition-colors ${
                            it.isEstourado ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-black/[0.02]'
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center text-ink-muted">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-brand" /> : <ChevronRight className="w-4 h-4" />}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-ink-primary font-mono">{it.planoContaNivel2Codigo}</span>
                            <span className="text-ink-primary ml-2 font-bold">{it.planoContaNivel2Nome}</span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold">
                            {formatCurrency(it.orcadoCentavos)}
                          </td>

                          {compararV1 && (
                            <>
                              <td className="py-3.5 px-4 text-right font-mono text-purple-700 bg-purple-50/30">
                                {formatCurrency(it.orcadoV1Centavos || 0)}
                              </td>
                              <td className={`py-3.5 px-4 text-right font-mono font-bold bg-purple-50/30 ${
                                (it.variacaoReaisCentavos || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                                {formatCurrency(it.variacaoReaisCentavos || 0)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono text-xs font-bold bg-purple-50/30">
                                {(it.variacaoPercentual || 0).toFixed(1)}%
                              </td>
                            </>
                          )}

                          <td className="py-3.5 px-4 text-right font-mono text-amber-600 font-bold">
                            {formatCurrency(it.comprometidoCentavos)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-bold">
                            {formatCurrency(it.realizadoCentavos)}
                          </td>

                          <td className={`py-3.5 px-4 text-right font-mono font-bold ${
                            it.saldoCentavos < 0 ? 'text-rose-600' : 'text-brand'
                          }`}>
                            {formatCurrency(it.saldoCentavos)}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center justify-between w-full text-[11px] font-bold font-mono">
                                <span>{it.percentualConsumido.toFixed(1)}%</span>
                                {getSemaforoBadge(it.percentualConsumido)}
                              </div>
                              <div className="w-full bg-black/5 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full ${getSemaforoColor(it.percentualConsumido)}`}
                                  style={{ width: `${Math.min(100, it.percentualConsumido)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-surface-muted/60">
                            <td colSpan={compararV1 ? 10 : 7} className="p-4 space-y-4 border-t border-b border-black/10">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-surface p-3 rounded-xl border border-black/10 space-y-2">
                                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    Títulos no Comprometido ({it.comprometidoTitulos?.length || 0})
                                  </span>

                                  {!it.comprometidoTitulos || it.comprometidoTitulos.length === 0 ? (
                                    <p className="text-[11px] text-ink-muted italic">Nenhum título em aberto comprometendo este grupo.</p>
                                  ) : (
                                    <div className="overflow-x-auto max-h-48">
                                      <table className="w-full text-left text-[11px]">
                                        <thead>
                                          <tr className="text-ink-muted border-b border-black/10 font-bold">
                                            <th className="p-1">Doc / Fornecedor</th>
                                            <th className="p-1 text-center">Vencimento</th>
                                            <th className="p-1 text-right">Rateio %</th>
                                            <th className="p-1 text-right">Valor Rateado</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/5">
                                          {it.comprometidoTitulos.map(t => (
                                            <tr key={t.parcelaId}>
                                              <td className="p-1">
                                                <span className="font-bold text-ink-primary block">{t.pessoaNome}</span>
                                                <span className="text-[10px] text-ink-muted">Doc: {t.numeroDocumento || '-'}</span>
                                              </td>
                                              <td className="p-1 text-center font-mono">{t.dataVencimento.split('-').reverse().join('/')}</td>
                                              <td className="p-1 text-right font-mono">{t.percentualRateio}%</td>
                                              <td className="p-1 text-right font-mono font-bold text-amber-600">
                                                {formatCurrency(t.valorRateadoCentavos)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>

                                <div className="bg-surface p-3 rounded-xl border border-black/10 space-y-2">
                                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Movimentações de Caixa Realizadas ({it.realizadoMovimentos?.length || 0})
                                  </span>

                                  {!it.realizadoMovimentos || it.realizadoMovimentos.length === 0 ? (
                                    <p className="text-[11px] text-ink-muted italic">Nenhuma movimentação de caixa realizada neste grupo.</p>
                                  ) : (
                                    <div className="overflow-x-auto max-h-48">
                                      <table className="w-full text-left text-[11px]">
                                        <thead>
                                          <tr className="text-ink-muted border-b border-black/10 font-bold">
                                            <th className="p-1">Pagamento / Fornecedor</th>
                                            <th className="p-1 text-center">Data Pagto</th>
                                            <th className="p-1 text-right">Forma</th>
                                            <th className="p-1 text-right">Valor Pago Rateado</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/5">
                                          {it.realizadoMovimentos.map(m => (
                                            <tr key={m.movimentoId}>
                                              <td className="p-1">
                                                <span className="font-bold text-ink-primary block">{m.pessoaNome}</span>
                                                <span className="text-[10px] text-ink-muted">Doc: {m.numeroDocumento || '-'}</span>
                                              </td>
                                              <td className="p-1 text-center font-mono">{m.dataPagamento.split('-').reverse().join('/')}</td>
                                              <td className="p-1 text-right font-mono uppercase text-[10px]">{m.formaPagamento}</td>
                                              <td className="p-1 text-right font-mono font-bold text-emerald-600">
                                                {formatCurrency(m.valorRateadoMovimentoCentavos)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-muted font-mono font-bold text-xs border-t-2 border-black/10">
                    <td colSpan={2} className="py-4 px-4 text-right uppercase text-ink-muted">Totais Consolidados:</td>
                    <td className="py-4 px-4 text-right text-ink-primary">{formatCurrency(execucaoData.totalOrcadoCentavos)}</td>
                    {compararV1 && (
                      <>
                        <td className="py-4 px-4 text-right text-purple-700">{formatCurrency(execucaoData.totalOrcadoV1Centavos || 0)}</td>
                        <td className="py-4 px-4 text-right text-purple-700">{formatCurrency(execucaoData.variacaoV1TotalCentavos || 0)}</td>
                        <td className="py-4 px-4 text-right text-purple-700">{(execucaoData.variacaoV1TotalPercentual || 0).toFixed(1)}%</td>
                      </>
                    )}
                    <td className="py-4 px-4 text-right text-amber-600">{formatCurrency(execucaoData.totalComprometidoCentavos)}</td>
                    <td className="py-4 px-4 text-right text-emerald-600">{formatCurrency(execucaoData.totalRealizadoCentavos)}</td>
                    <td className="py-4 px-4 text-right text-brand">{formatCurrency(execucaoData.totalSaldoCentavos)}</td>
                    <td className="py-4 px-4 text-center text-ink-primary">{execucaoData.totalPercentualConsumido.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* CURVA S */}
          <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand block">Curva S Executiva</span>
                <h2 className="text-lg font-bold text-ink-primary">Curva S de Execução Física e Financeira</h2>
              </div>
              <span className="text-xs text-ink-muted">
                Comparativo acumulado: Orçado vs Comprometido vs Realizado
              </span>
            </div>

            <div className="p-4 bg-brand/5 border border-brand/20 rounded-2xl flex items-center gap-3">
              <Info className="w-5 h-5 text-brand shrink-0" />
              <p className="text-xs font-bold text-ink-primary leading-relaxed">
                {execucaoData.fraseStatusCurvaS}
              </p>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={execucaoData.curvaS} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="rotuloMes" style={{ fontSize: '11px', fontFamily: 'monospace' }} />
                  <YAxis 
                    style={{ fontSize: '10px', fontFamily: 'monospace' }}
                    tickFormatter={(val) => `R$ ${(val / 100000).toFixed(0)}k`}
                  />
                  <RechartsTooltip 
                    formatter={(value: any) => formatCurrency(Number(value))}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                  <Line 
                    type="monotone" 
                    dataKey="orcadoAcumuladoCentavos" 
                    name="Orçado Acumulado (Planejado)" 
                    stroke="#7C4DFF" 
                    strokeWidth={3} 
                    dot={{ r: 4 }} 
                  />

                  <Line 
                    type="monotone" 
                    dataKey="comprometidoAcumuladoCentavos" 
                    name="Comprometido Acumulado" 
                    stroke="#D97706" 
                    strokeWidth={2} 
                    strokeDasharray="5 5" 
                  />

                  <Line 
                    type="monotone" 
                    dataKey="realizadoAcumuladoCentavos" 
                    name="Realizado Acumulado (Caixa)" 
                    stroke="#10B981" 
                    strokeWidth={3} 
                    dot={{ r: 4 }} 
                  />

                  <ReferenceLine x="07/26" stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Hoje', fill: '#EF4444', fontSize: 11, fontWeight: 'bold' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
