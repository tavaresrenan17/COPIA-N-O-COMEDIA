'use client';

import { ModuloDesativado } from '@/components/ModuloDesativado';

import React, { useEffect, useState } from 'react';
import { 
  erpRepository, 
  FluxoCaixaResultado, 
  FluxoCaixaBucket, 
  ContaBancaria, 
  CentroCusto,
  AgrupamentoFluxoCaixa,
  CamadaFluxoCaixa
} from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { 
  Calendar, 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Filter, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownLeft 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine, 
  CartesianGrid 
} from 'recharts';

function FluxoCaixaPage() {
  const hojeStr = new Date().toISOString().split('T')[0];
  const mais90DiasStr = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Filtros
  const [dataDe, setDataDe] = useState(hojeStr);
  const [dataAte, setDataAte] = useState(mais90DiasStr);
  const [agrupamento, setAgrupamento] = useState<AgrupamentoFluxoCaixa>('dia');
  const [camada, setCamada] = useState<CamadaFluxoCaixa>('ambos');
  const [contaBancariaId, setContaBancariaId] = useState('');
  const [centroCustoId, setCentroCustoId] = useState('');

  // Listas de apoio
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);

  // Dados do Fluxo de Caixa
  const [resultado, setResultado] = useState<FluxoCaixaResultado | null>(null);
  const [loading, setLoading] = useState(true);

  // Linha Expandida na Tabela
  const [expandedPeriodo, setExpandedPeriodo] = useState<string | null>(null);

  useEffect(() => {
    loadAuxiliaryData();
  }, []);

  useEffect(() => {
    loadFluxoCaixa();
  }, [dataDe, dataAte, agrupamento, camada, contaBancariaId, centroCustoId]);

  async function loadAuxiliaryData() {
    const [cbList, ccList] = await Promise.all([
      erpRepository.getContasBancarias({ apenasAtivos: true }),
      erpRepository.getCentrosCusto({ apenasAtivos: true })
    ]);
    setContasBancarias(cbList);
    setCentrosCusto(ccList);
  }

  async function loadFluxoCaixa() {
    setLoading(true);
    const res = await erpRepository.getFluxoCaixa({
      dataDe,
      dataAte,
      agrupamento,
      camada,
      contaBancariaId: contaBancariaId || undefined,
      centroCustoId: centroCustoId || undefined
    });
    setResultado(res);
    setLoading(false);
  }

  // Exportação CSV do Período Filtrado
  const handleExportCSV = () => {
    if (!resultado || resultado.buckets.length === 0) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Periodo;Saldo Inicial (R$);Entradas (R$);Saidas (R$);Resultado (R$);Saldo Final (R$);Status Furo\n';

    resultado.buckets.forEach(b => {
      csvContent += `${b.periodoRotulo};${(b.saldoInicialCentavos/100).toFixed(2)};${(b.entradasCentavos/100).toFixed(2)};${(b.saidasCentavos/100).toFixed(2)};${(b.resultadoCentavos/100).toFixed(2)};${(b.saldoFinalCentavos/100).toFixed(2)};${b.isFuroCaixa ? 'FURO DE CAIXA' : 'OK'}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fluxo_caixa_${dataDe}_ate_${dataAte}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dados formatados para o gráfico Recharts
  const chartData = (resultado?.buckets || []).map(b => ({
    periodo: b.periodoRotulo,
    data: b.dataInicioPeriodo,
    saldoAcumulado: Number((b.saldoFinalCentavos / 100).toFixed(2)),
    isFuro: b.isFuroCaixa
  }));

  return (
    <div className="space-y-6">
      {/* Header & Ação Exportar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <div className="flex items-center gap-2 text-brand mb-1">
            <Layers className="w-5 h-5 stroke-[2.5]" />
            <span className="text-xs font-bold uppercase tracking-wider">Painel Analítico Executivo</span>
          </div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">Demonstrativo de Fluxo de Caixa</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Consolidação de movimentações realizadas e previsões por vencimento com cálculo contínuo de caixa.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={!resultado || resultado.buckets.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-black/10 hover:bg-black/5 text-ink-primary rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-40"
        >
          <Download className="w-4 h-4 text-brand" />
          <span>Exportar Relatório CSV</span>
        </button>
      </div>

      {/* KPI Cards no Topo */}
      {resultado && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Saldo Hoje */}
          <div className="bg-surface rounded-2xl p-4 shadow-soft border border-black/[0.03] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block">Saldo Hoje (Contas)</span>
              <span className="text-xl font-bold text-ink-primary tracking-tight mt-1 block">
                {formatCurrency(resultado.saldoHojeCentavos)}
              </span>
              <span className="text-[10px] text-ink-muted mt-0.5 block">Disponibilidade atual</span>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Entradas Previstas */}
          <div className="bg-surface rounded-2xl p-4 shadow-soft border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Entradas no Período</span>
              <span className="text-xl font-bold text-emerald-600 tracking-tight mt-1 block">
                +{formatCurrency(resultado.totalEntradasPrevistasCentavos)}
              </span>
              <span className="text-[10px] text-emerald-600 mt-0.5 block">Recebimentos acumulados</span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Saídas Previstas */}
          <div className="bg-surface rounded-2xl p-4 shadow-soft border border-rose-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Saídas no Período</span>
              <span className="text-xl font-bold text-rose-600 tracking-tight mt-1 block">
                -{formatCurrency(resultado.totalSaidasPrevistasCentavos)}
              </span>
              <span className="text-[10px] text-rose-500 mt-0.5 block">Pagamentos previstos</span>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Menor Saldo / Destaque Furo de Caixa */}
          <div className={`rounded-2xl p-4 shadow-soft border ${
            resultado.primeiraDataFuroCaixa ? 'bg-rose-50 border-rose-300' : 'bg-surface border-black/[0.03]'
          } flex items-center justify-between`}>
            <div>
              <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                resultado.primeiraDataFuroCaixa ? 'text-rose-700' : 'text-ink-muted'
              }`}>
                {resultado.primeiraDataFuroCaixa ? '⚠️ ALERTA: Furo de Caixa' : 'Menor Saldo Projetado'}
              </span>
              <span className={`text-xl font-bold tracking-tight mt-1 block ${
                resultado.menorSaldoProjetadoCentavos < 0 ? 'text-rose-700' : 'text-ink-primary'
              }`}>
                {formatCurrency(resultado.menorSaldoProjetadoCentavos)}
              </span>
              <span className={`text-[10px] font-bold mt-0.5 block ${
                resultado.primeiraDataFuroCaixa ? 'text-rose-800' : 'text-ink-muted'
              }`}>
                {resultado.primeiraDataFuroCaixa 
                  ? `Fura em: ${resultado.primeiraDataFuroCaixa.split('-').reverse().join('/')}` 
                  : `Em: ${resultado.dataMenorSaldoProjetado?.split('-').reverse().join('/') || '-'}`}
              </span>
            </div>
            <div className={`p-3 rounded-xl ${
              resultado.primeiraDataFuroCaixa ? 'bg-rose-200 text-rose-800' : 'bg-brand/10 text-brand'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Painel de Filtros */}
      <div className="bg-surface rounded-2xl p-4 shadow-soft border border-black/[0.03] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Período De / Até */}
          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">De *</label>
            <input
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Até *</label>
            <input
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Agrupamento */}
          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Agrupamento</label>
            <select
              value={agrupamento}
              onChange={(e) => setAgrupamento(e.target.value as AgrupamentoFluxoCaixa)}
              className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="dia">Por Dia</option>
              <option value="semana">Por Semana</option>
              <option value="mes">Por Mês</option>
            </select>
          </div>

          {/* Conta Bancária */}
          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Conta Bancária</label>
            <select
              value={contaBancariaId}
              onChange={(e) => setContaBancariaId(e.target.value)}
              className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Todas as Contas</option>
              {contasBancarias.map(cb => (
                <option key={cb.id} value={cb.id}>{cb.nome}</option>
              ))}
            </select>
          </div>

          {/* Centro de Custo (Respeita Rateio) */}
          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Centro de Custo (Rateio)</label>
            <select
              value={centroCustoId}
              onChange={(e) => setCentroCustoId(e.target.value)}
              className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Todos os Centros</option>
              {centrosCusto.map(cc => (
                <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toggle de Camadas */}
        <div className="flex items-center justify-between border-t border-black/5 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-muted">Camadas Visíveis:</span>
            <div className="inline-flex bg-surface-muted p-1 rounded-xl border border-black/5">
              <button
                type="button"
                onClick={() => setCamada('realizado')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  camada === 'realizado' ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                Apenas Realizado (Caixa)
              </button>
              <button
                type="button"
                onClick={() => setCamada('previsto')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  camada === 'previsto' ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                Apenas Previsto (Aberto)
              </button>
              <button
                type="button"
                onClick={() => setCamada('ambos')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  camada === 'ambos' ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                Ambos Somados (Consolidado)
              </button>
            </div>
          </div>

          {resultado?.primeiraDataFuroCaixa && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Caixa Fura em {resultado.primeiraDataFuroCaixa.split('-').reverse().join('/')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico Recharts do Saldo Acumulado */}
      <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink-primary">Evolução do Saldo Acumulado de Caixa (R$)</h3>
            <p className="text-xs text-ink-muted">Curva de caixa contínua no período com marcação de zero.</p>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs text-ink-muted">Processando gráfico...</div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C4DFF" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#7C4DFF" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `R$ ${val}`} />
                <Tooltip
                  formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Saldo Acumulado']}
                  contentStyle={{ backgroundColor: '#171526', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                {/* Linha Zero do Caixa */}
                <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Limite ZERO (Furo)', fill: '#EF4444', fontSize: 11, position: 'insideTopLeft' }} />
                <Area type="monotone" dataKey="saldoAcumulado" stroke="#7C4DFF" strokeWidth={3} fillOpacity={1} fill="url(#colorSaldo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tabela de Períodos Expansível */}
      <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.03] overflow-hidden space-y-2">
        <div className="p-4 border-b border-black/5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-primary">Detalhamento por Período</h3>
          <span className="text-xs text-ink-muted">Clique em uma linha para expandir os lançamentos individuais</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-ink-muted">Carregando demonstrativo...</div>
        ) : !resultado || resultado.buckets.length === 0 ? (
          <div className="p-12 text-center text-ink-muted">Nenhum dado encontrado para o período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-muted text-[11px] font-bold uppercase tracking-wider text-ink-muted border-b border-black/[0.05]">
                  <th className="py-3 px-4">Período</th>
                  <th className="py-3 px-4 text-right">Saldo Inicial</th>
                  <th className="py-3 px-4 text-right">Entradas (+)</th>
                  <th className="py-3 px-4 text-right">Saídas (-)</th>
                  <th className="py-3 px-4 text-right">Resultado Dia</th>
                  <th className="py-3 px-4 text-right">Saldo Final</th>
                  <th className="py-3 px-4 text-center">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03] text-xs font-medium text-ink-primary">
                {resultado.buckets.map((b, idx) => {
                  const isExpanded = expandedPeriodo === b.periodoRotulo;
                  const isFuro = b.isFuroCaixa;

                  return (
                    <React.Fragment key={idx}>
                      <tr
                        onClick={() => setExpandedPeriodo(isExpanded ? null : b.periodoRotulo)}
                        className={`cursor-pointer transition-colors ${
                          isFuro ? 'bg-rose-50/80 hover:bg-rose-100/80' : 'hover:bg-black/[0.01]'
                        }`}
                      >
                        <td className="py-3 px-4 font-bold flex items-center gap-2">
                          <span>{b.periodoRotulo}</span>
                          {isFuro && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-200 text-rose-800 text-[10px] font-bold">
                              FURO
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-ink-muted">
                          {formatCurrency(b.saldoInicialCentavos)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          +{formatCurrency(b.entradasCentavos)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                          -{formatCurrency(b.saidasCentavos)}
                        </td>

                        <td className={`py-3 px-4 text-right font-mono font-bold ${
                          b.resultadoCentavos >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {b.resultadoCentavos >= 0 ? '+' : ''}{formatCurrency(b.resultadoCentavos)}
                        </td>

                        <td className={`py-3 px-4 text-right font-mono font-bold text-sm ${
                          isFuro ? 'text-rose-700' : 'text-ink-primary'
                        }`}>
                          {formatCurrency(b.saldoFinalCentavos)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button className="p-1 text-ink-muted hover:text-brand">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* LINHA EXPANDIDA COM OS LANÇAMENTOS INDIVIDUAIS */}
                      {isExpanded && (
                        <tr className="bg-surface-muted">
                          <td colSpan={7} className="p-4">
                            <div className="bg-surface rounded-xl p-4 border border-black/5 space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-brand">
                                Lançamentos Individuais do Período ({b.periodoRotulo})
                              </h4>

                              {b.lancamentos.length === 0 ? (
                                <div className="text-xs text-ink-muted">Nenhum lançamento específico nesta data.</div>
                              ) : (
                                <div className="space-y-1.5">
                                  {b.lancamentos.map((l, lIdx) => (
                                    <div key={lIdx} className="flex items-center justify-between bg-surface-muted p-2.5 rounded-lg border border-black/5 text-xs">
                                      <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                          l.tipo === 'R' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                        }`}>
                                          {l.tipo === 'R' ? 'Entrada' : 'Saída'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                          l.camada === 'realizado' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {l.camada}
                                        </span>
                                        <div>
                                          <span className="font-bold text-ink-primary block">{l.descricao}</span>
                                          <span className="text-[10px] text-ink-muted">
                                            {l.pessoaNome} | CC: {l.centroCustoNome} | Doc: {l.numeroDocumento || 'S/N'}
                                          </span>
                                        </div>
                                      </div>

                                      <span className={`font-mono font-bold ${l.tipo === 'R' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {l.tipo === 'R' ? '+' : '-'}{formatCurrency(l.valorCentavos)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/*
 * Módulo desativado a pedido: não está em uso no momento.
 * O componente FluxoCaixaPage acima permanece intacto — para reativar, devolva o
 * `export default` a ele e remova `inativo: true` em src/data/departments.ts.
 */
export default function Page() {
  return <ModuloDesativado nome="Fluxo de Caixa" />;
}
