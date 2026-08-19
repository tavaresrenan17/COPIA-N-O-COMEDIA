'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  erpRepository, 
  DashboardExecutiveData, 
  CentroCusto, 
  DespesaPlanoContaGroup 
} from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { 
  BarChart3, 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ChevronRight, 
  Users, 
  Building2, 
  PieChart, 
  Calendar, 
  Layers, 
  X,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Cell 
} from 'recharts';

export default function DashboardExecutivePage() {
  const router = useRouter();

  // Datas Default: Primeiro e último dia do mês atual
  const now = new Date();
  const primeiroDiaMesStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaMesStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // FILTRO GLOBAL
  const [dataDe, setDataDe] = useState(primeiroDiaMesStr);
  const [dataAte, setDataAte] = useState(ultimoDiaMesStr);
  const [centroCustoId, setCentroCustoId] = useState('');

  // LISTAS DE APOIO
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [data, setData] = useState<DashboardExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal para detalhamento do Bloco 5 (Plano de Contas Nível 2)
  const [selectedGroupPc, setSelectedGroupPc] = useState<DespesaPlanoContaGroup | null>(null);

  useEffect(() => {
    loadAuxiliaryData();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [dataDe, dataAte, centroCustoId]);

  async function loadAuxiliaryData() {
    const list = await erpRepository.getCentrosCusto({ apenasAtivos: true });
    setCentrosCusto(list);
  }

  async function loadDashboardData() {
    setLoading(true);
    const res = await erpRepository.getDashboardExecutiveData({
      dataDe,
      dataAte,
      centroCustoId: centroCustoId || undefined
    });
    setData(res);
    setLoading(false);
  }

  const COLORS_CHART = ['#7C4DFF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

  return (
    <div className="space-y-6 pb-8">
      {/* HEADER & FILTRO GLOBAL NO TOPO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <div className="flex items-center gap-2 text-brand mb-1">
            <BarChart3 className="w-5 h-5 stroke-[2.5]" />
            <span className="text-xs font-bold uppercase tracking-wider">Painel Executivo Financeiro</span>
          </div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">Dashboard de Gestão & Indicadores</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Visão consolidada do fluxo de caixa e resultado contábil do ERP Melhor Gestão.
          </p>
        </div>

        {/* Barra de Filtro Global */}
        <div className="flex flex-wrap items-center gap-3 bg-surface-muted p-2.5 rounded-xl border border-black/5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink-muted">Período:</span>
            <input
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className="bg-surface border border-black/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <span className="text-xs text-ink-muted">até</span>
            <input
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className="bg-surface border border-black/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink-muted">Centro Custo:</span>
            <select
              value={centroCustoId}
              onChange={(e) => setCentroCustoId(e.target.value)}
              className="bg-surface border border-black/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Todos os Centros</option>
              {centrosCusto.map(cc => (
                <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* BLOCO 1 — CARDS DE TOPO (LINHA DE 4 CARDS - VISÃO CAIXA/VENCIMENTO) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">
            Bloco 1 — Indicadores Imediatos (Visão por Caixa / Vencimento)
          </span>
        </div>

        {loading || !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-surface rounded-2xl p-5 h-24 animate-pulse border border-black/[0.03]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1: Saldo Consolidado Hoje */}
            <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block">Saldo Consolidado Hoje</span>
                <span className="text-2xl font-bold text-ink-primary tracking-tight mt-1 block">
                  {formatCurrency(data.saldoConsolidadoHojeCentavos)}
                </span>
                <span className="text-[10px] text-ink-muted mt-0.5 block">Soma de todas as contas</span>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: A Receber 30 Dias (Clicável) */}
            <div 
              onClick={() => router.push('/contas-receber')}
              className="bg-surface rounded-2xl p-5 shadow-soft border border-emerald-100 flex items-center justify-between cursor-pointer hover:border-emerald-300 transition-all group"
            >
              <div>
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">A Receber em 30 Dias</span>
                <span className="text-2xl font-bold text-emerald-600 tracking-tight mt-1 block">
                  +{formatCurrency(data.aReceber30DiasCentavos)}
                </span>
                <span className="text-[10px] text-emerald-600 mt-0.5 block group-hover:underline">Clique para navegar →</span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3: A Pagar 30 Dias (Clicável) */}
            <div 
              onClick={() => router.push('/contas-pagar')}
              className="bg-surface rounded-2xl p-5 shadow-soft border border-rose-100 flex items-center justify-between cursor-pointer hover:border-rose-300 transition-all group"
            >
              <div>
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">A Pagar em 30 Dias</span>
                <span className="text-2xl font-bold text-rose-600 tracking-tight mt-1 block">
                  -{formatCurrency(data.aPagar30DiasCentavos)}
                </span>
                <span className="text-[10px] text-rose-500 mt-0.5 block group-hover:underline">Clique para navegar →</span>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-105 transition-transform">
                <ArrowUpRight className="w-6 h-6" />
              </div>
            </div>

            {/* Card 4: Resultado Projetado 30 Dias */}
            <div className={`bg-surface rounded-2xl p-5 shadow-soft border ${
              data.resultadoProjetado30DiasCentavos >= 0 ? 'border-emerald-200' : 'border-rose-200'
            } flex items-center justify-between`}>
              <div>
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block">Resultado Projetado 30D</span>
                <span className={`text-2xl font-bold tracking-tight mt-1 block ${
                  data.resultadoProjetado30DiasCentavos >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {data.resultadoProjetado30DiasCentavos >= 0 ? '+' : ''}{formatCurrency(data.resultadoProjetado30DiasCentavos)}
                </span>
                <span className="text-[10px] text-ink-muted mt-0.5 block">(A Receber - A Pagar)</span>
              </div>
              <div className={`p-3 rounded-xl ${
                data.resultadoProjetado30DiasCentavos >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {data.resultadoProjetado30DiasCentavos >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BLOCO 2 — ALERTA DE VENCIDOS (URGÊNCIA DA TELA - VISÃO CAIXA/VENCIMENTO) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Bloco 2 — Painel Urgente de Vencidos (Visão por Vencimento)
          </span>
        </div>

        {loading || !data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface rounded-2xl p-5 h-32 animate-pulse border border-black/[0.03]" />
            <div className="bg-surface rounded-2xl p-5 h-32 animate-pulse border border-black/[0.03]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Vencidos A Receber (Inadimplência de Clientes) */}
            <div 
              onClick={() => router.push('/contas-receber?status=vencido')}
              className="bg-surface rounded-2xl p-5 shadow-soft border border-emerald-200 hover:border-emerald-400 transition-all cursor-pointer group space-y-3"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-2">
                <span className="text-xs font-bold uppercase text-emerald-700 flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  Inadimplência de Clientes (A Receber Vencido)
                </span>
                <span className="text-[11px] font-semibold text-brand group-hover:underline">Ver Listagem →</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-emerald-600 block">
                    {formatCurrency(data.vencidos.totalReceberVencidoCentavos)}
                  </span>
                  <span className="text-xs text-ink-muted block mt-0.5">
                    <strong>{data.vencidos.qtdTitulosReceberVencidos}</strong> parcelas atrasadas
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg inline-block border border-rose-100">
                    Maior Atraso: {data.vencidos.maiorAtrasoReceberDias} dias
                  </span>
                </div>
              </div>
            </div>

            {/* Vencidos A Pagar (Atraso Próprio) */}
            <div 
              onClick={() => router.push('/contas-pagar?status=vencido')}
              className="bg-surface rounded-2xl p-5 shadow-soft border border-rose-200 hover:border-rose-400 transition-all cursor-pointer group space-y-3"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-2">
                <span className="text-xs font-bold uppercase text-rose-700 flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  Atraso Próprio (A Pagar Vencido)
                </span>
                <span className="text-[11px] font-semibold text-brand group-hover:underline">Ver Listagem →</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-rose-600 block">
                    {formatCurrency(data.vencidos.totalPagarVencidoCentavos)}
                  </span>
                  <span className="text-xs text-ink-muted block mt-0.5">
                    <strong>{data.vencidos.qtdTitulosPagarVencidos}</strong> parcelas atrasadas
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg inline-block border border-rose-100">
                    Maior Atraso: {data.vencidos.maiorAtrasoPagarDias} dias
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BLOCO 3 & BLOCO 4 (GRID DUPLO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* BLOCO 3 — CURVA DE CAIXA 90 DIAS (VISÃO CAIXA/VENCIMENTO) */}
        <div 
          onClick={() => router.push('/fluxo-caixa')}
          className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] space-y-3 cursor-pointer hover:border-brand/40 transition-all group"
        >
          <div className="flex items-center justify-between border-b border-black/5 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                Bloco 3 — Curva de Caixa Projeta 90 Dias
              </h3>
              <span className="text-[10px] text-ink-muted block">Visão por Vencimento / Caixa</span>
            </div>
            <span className="text-xs text-brand font-bold group-hover:underline flex items-center gap-1">
              <span>Abrir Fluxo Completo</span>
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>

          {loading || !data ? (
            <div className="h-56 animate-pulse bg-surface-muted rounded-xl" />
          ) : data.curva90Dias.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-ink-muted">Sem projeção para 90 dias.</div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.curva90Dias}>
                  <defs>
                    <linearGradient id="colorCurva" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C4DFF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#7C4DFF" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="periodoRotulo" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Saldo Acumulado']} />
                  <Area type="monotone" dataKey="saldoAcumuladoCentavos" stroke="#7C4DFF" strokeWidth={2.5} fill="url(#colorCurva)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* BLOCO 4 — DESPESA POR CENTRO DE CUSTO (VISÃO POR COMPETÊNCIA) */}
        <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] space-y-3">
          <div className="flex items-center justify-between border-b border-black/5 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                Bloco 4 — Top Centros de Custo
              </h3>
              <span className="text-[10px] text-ink-muted block">Visão por Competência (Com Rateio Proporcional)</span>
            </div>
          </div>

          {loading || !data ? (
            <div className="h-56 animate-pulse bg-surface-muted rounded-xl" />
          ) : data.despesasPorCentroCusto.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-ink-muted">Nenhuma despesa de centro de custo no período.</div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.despesasPorCentroCusto} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748B' }} width={120} />
                  <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Despesa Total']} />
                  <Bar dataKey="valorCentavos" radius={[0, 6, 6, 0]}>
                    {data.despesasPorCentroCusto.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_CHART[index % COLORS_CHART.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* BLOCO 5 & BLOCO 6 (GRID DUPLO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* BLOCO 5 — DESPESA POR PLANO DE CONTAS NÍVEL 2 (VISÃO POR COMPETÊNCIA) */}
        <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] space-y-3">
          <div className="flex items-center justify-between border-b border-black/5 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                Bloco 5 — Despesas por Plano Financeiro (Nível 2)
              </h3>
              <span className="text-[10px] text-ink-muted block">Visão por Competência (Clique para expandir grupo)</span>
            </div>
          </div>

          {loading || !data ? (
            <div className="h-60 animate-pulse bg-surface-muted rounded-xl" />
          ) : data.despesasPorPlanoContaNivel2.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-ink-muted">Nenhuma despesa registrada no período.</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {data.despesasPorPlanoContaNivel2.map((grp) => (
                <div
                  key={grp.grupoId}
                  onClick={() => setSelectedGroupPc(grp)}
                  className="flex items-center justify-between bg-surface-muted hover:bg-black/5 p-3 rounded-xl border border-black/5 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 bg-brand/10 text-brand rounded">
                      {grp.codigo}
                    </span>
                    <span className="text-xs font-bold text-ink-primary group-hover:text-brand">{grp.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-xs font-bold text-rose-600">{formatCurrency(grp.valorCentavos)}</span>
                    <ChevronRight className="w-4 h-4 text-ink-muted group-hover:text-brand" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BLOCO 6 — TOP 5 FORNECEDORES & TOP 5 CLIENTES (VISÃO POR COMPETÊNCIA) */}
        <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] space-y-3">
          <div className="flex items-center justify-between border-b border-black/5 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                Bloco 6 — Top 5 Fornecedores & Clientes
              </h3>
              <span className="text-[10px] text-ink-muted block">Visão por Competência</span>
            </div>
          </div>

          {loading || !data ? (
            <div className="h-60 animate-pulse bg-surface-muted rounded-xl" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Top Fornecedores */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase text-rose-600 block border-b border-rose-100 pb-1">
                  Top Fornecedores (Saídas)
                </span>
                {data.top5Fornecedores.length === 0 ? (
                  <span className="text-xs text-ink-muted block py-2">Sem saídas.</span>
                ) : (
                  data.top5Fornecedores.map((f, i) => (
                    <div 
                      key={f.pessoaId}
                      onClick={() => router.push('/contas-pagar')}
                      className="p-2 bg-surface-muted rounded-lg border border-black/5 flex items-center justify-between text-xs cursor-pointer hover:bg-black/5"
                    >
                      <div className="truncate max-w-[120px]">
                        <span className="font-bold block truncate">{i + 1}. {f.nome}</span>
                        <span className="text-[10px] text-ink-muted">{f.qtdTitulos} títulos</span>
                      </div>
                      <span className="font-mono font-bold text-rose-600">{formatCurrency(f.valorCentavos)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Top Clientes */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase text-emerald-600 block border-b border-emerald-100 pb-1">
                  Top Clientes (Entradas)
                </span>
                {data.top5Clientes.length === 0 ? (
                  <span className="text-xs text-ink-muted block py-2">Sem entradas.</span>
                ) : (
                  data.top5Clientes.map((c, i) => (
                    <div 
                      key={c.pessoaId}
                      onClick={() => router.push('/contas-receber')}
                      className="p-2 bg-surface-muted rounded-lg border border-black/5 flex items-center justify-between text-xs cursor-pointer hover:bg-black/5"
                    >
                      <div className="truncate max-w-[120px]">
                        <span className="font-bold block truncate">{i + 1}. {c.nome}</span>
                        <span className="text-[10px] text-ink-muted">{c.qtdTitulos} títulos</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600">{formatCurrency(c.valorCentavos)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE EXPANSÃO DO BLOCO 5 (DETALHAMENTO DE CONTAS FOLHA DO PLANO DE CONTAS NÍVEL 2) */}
      {selectedGroupPc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-black/10 space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-ink-primary">
                  {selectedGroupPc.codigo} - {selectedGroupPc.nome}
                </h3>
                <span className="text-xs text-ink-muted">Detalhamento por Contas Folha (Regime de Competência)</span>
              </div>
              <button onClick={() => setSelectedGroupPc(null)} className="text-ink-muted hover:text-ink-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-brand/10 rounded-xl flex items-center justify-between font-mono">
              <span className="text-xs font-bold text-brand">Total do Grupo:</span>
              <span className="text-base font-bold text-rose-600">{formatCurrency(selectedGroupPc.valorCentavos)}</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedGroupPc.folhas.map((f) => (
                <div key={f.planoContaId} className="flex items-center justify-between bg-surface-muted p-2.5 rounded-lg border border-black/5 text-xs font-medium">
                  <div>
                    <span className="font-bold text-ink-primary block">{f.codigo} - {f.nome}</span>
                  </div>
                  <span className="font-mono font-bold text-rose-600">{formatCurrency(f.valorCentavos)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedGroupPc(null)}
                className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
