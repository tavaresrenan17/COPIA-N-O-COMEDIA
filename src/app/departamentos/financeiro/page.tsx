'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { erpRepository, ParcelaView, ContaBancaria, CentroCusto } from '@/data';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Landmark,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  PieChart,
  ShieldAlert,
  BarChart2,
  Check,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

export default function FinanceiroPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [titulosPagarUrgentes, setTitulosPagarUrgentes] = useState<ParcelaView[]>([]);
  const [titulosReceberUrgentes, setTitulosReceberUrgentes] = useState<ParcelaView[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);

  // Totais consolidados
  const [totalPagarCentavos, setTotalPagarCentavos] = useState(0);
  const [totalReceberCentavos, setTotalReceberCentavos] = useState(0);
  const [totalVencidoPagarCentavos, setTotalVencidoPagarCentavos] = useState(0);
  const [totalVencidoReceberCentavos, setTotalVencidoReceberCentavos] = useState(0);

  useEffect(() => {
    async function carregarDadosFinanceiros() {
      try {
        setLoading(true);

        // 1. Buscar parcelas de Contas a Pagar
        const parcelasPagar = await erpRepository.getParcelasView('P', { apenasAtivos: true });
        // Filtrar pendentes (aberto, parcial, vencido)
        const pendentesPagar = parcelasPagar.filter(
          (p) => p.status === 'aberto' || p.status === 'parcial' || p.status === 'vencido'
        );

        // Somar totais
        const somaPagar = pendentesPagar.reduce((acc, item) => acc + item.saldoCentavos, 0);
        const somaVencidoPagar = pendentesPagar
          .filter((p) => p.status === 'vencido')
          .reduce((acc, item) => acc + item.saldoCentavos, 0);

        setTotalPagarCentavos(somaPagar);
        setTotalVencidoPagarCentavos(somaVencidoPagar);

        // Ordenar por prioridade: vencidos primeiro, depois por data de vencimento
        const ordenadasPagar = [...pendentesPagar].sort((a, b) => {
          if (a.status === 'vencido' && b.status !== 'vencido') return -1;
          if (a.status !== 'vencido' && b.status === 'vencido') return 1;
          return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
        });
        setTitulosPagarUrgentes(ordenadasPagar.slice(0, 6));

        // 2. Buscar parcelas de Contas a Receber
        const parcelasReceber = await erpRepository.getParcelasView('R', { apenasAtivos: true });
        const pendentesReceber = parcelasReceber.filter(
          (p) => p.status === 'aberto' || p.status === 'parcial' || p.status === 'vencido'
        );

        const somaReceber = pendentesReceber.reduce((acc, item) => acc + item.saldoCentavos, 0);
        const somaVencidoReceber = pendentesReceber
          .filter((p) => p.status === 'vencido')
          .reduce((acc, item) => acc + item.saldoCentavos, 0);

        setTotalReceberCentavos(somaReceber);
        setTotalVencidoReceberCentavos(somaVencidoReceber);

        const ordenadasReceber = [...pendentesReceber].sort((a, b) => {
          if (a.status === 'vencido' && b.status !== 'vencido') return -1;
          if (a.status !== 'vencido' && b.status === 'vencido') return 1;
          return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
        });
        setTitulosReceberUrgentes(ordenadasReceber.slice(0, 6));

        // 3. Buscar Contas Bancárias
        const bancos = await erpRepository.getContasBancarias({ apenasAtivos: true });
        setContasBancarias(bancos);

        // 4. Buscar Centros de Custo
        const ccs = await erpRepository.getCentrosCusto({ apenasAtivos: true });
        setCentrosCusto(ccs.filter((c) => c.aceitaLancamento));
      } catch (err) {
        toast.error('Erro ao carregar o painel financeiro', {
          description: err instanceof Error ? err.message : 'Tente novamente.',
        });
      } finally {
        setLoading(false);
      }
    }

    carregarDadosFinanceiros();
  }, []);

  const saldoEmCaixaTotalCentavos = contasBancarias.reduce(
    (acc, b) => acc + (b.saldoInicialCentavos || 0),
    0
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Department Banner / Welcome Header */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-lg">
                <Wallet className="w-6 h-6" />
              </span>
              <div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 uppercase tracking-wider">
                  Ambiente Ativo
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight mt-1">
                  Departamento Financeiro
                </h1>
              </div>
            </div>
            <p className="text-slate-300 max-w-2xl text-sm leading-relaxed pt-1">
              Painel de gestão financeira. Acompanhe abaixo os títulos a pagar e a receber de maior prioridade, o saldo atual em caixa e o consumo orçamentário.
            </p>
          </div>
        </div>
      </div>

      {/* Indicadores Principais & Resumo do Caixa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Disponível */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Saldo Atual em Caixa</span>
            <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </span>
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-slate-800 block">
            {formatCurrency(saldoEmCaixaTotalCentavos)}
          </span>
          <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 mt-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Saldos das contas ativas</span>
          </span>
        </div>

        {/* Card 2: Contas a Pagar Pendentes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Contas a Pagar</span>
            <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-rose-600 block">
            {formatCurrency(totalPagarCentavos)}
          </span>
          {totalVencidoPagarCentavos > 0 ? (
            <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{formatCurrency(totalVencidoPagarCentavos)} em atraso</span>
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400 mt-2 block">
              Sem títulos vencidos
            </span>
          )}
        </div>

        {/* Card 3: Contas a Receber Pendentes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Contas a Receber</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-emerald-600 block">
            {formatCurrency(totalReceberCentavos)}
          </span>
          {totalVencidoReceberCentavos > 0 ? (
            <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1 mt-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{formatCurrency(totalVencidoReceberCentavos)} pendente cobrança</span>
            </span>
          ) : (
            <span className="text-[11px] font-medium text-emerald-600 mt-2 block">
              Cobranças em dia
            </span>
          )}
        </div>

        {/* Card 4: Resultado Projetado */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Resultado Líquido Projetado</span>
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BarChart2 className="w-4 h-4" />
            </span>
          </div>
          <span className={`text-2xl font-extrabold tracking-tight block ${
            (totalReceberCentavos - totalPagarCentavos) >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {formatCurrency(totalReceberCentavos - totalPagarCentavos)}
          </span>
          <span className="text-[11px] font-medium text-slate-400 mt-2 block">
            Diferença (Receber - Pagar)
          </span>
        </div>
      </div>

      {/* SEÇÃO PRINCIPAL DE TÍTULOS DE MAIOR IMPORTÂNCIA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TABELA DE CONTAS A PAGAR MAIS IMPORTANTES / VENCENDO */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Contas a Pagar Prioritárias</h3>
                  <p className="text-xs text-slate-400">Títulos vencidos e próximos vencimentos</p>
                </div>
              </div>

              <Link
                href="/contas-pagar"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Carregando títulos a pagar...</div>
            ) : titulosPagarUrgentes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Sem títulos a pagar pendentes no momento.</div>
            ) : (
              <div className="space-y-3">
                {titulosPagarUrgentes.map((item) => {
                  const isVencido = item.status === 'vencido';
                  return (
                    <div
                      key={item.parcelaId}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isVencido
                          ? 'bg-rose-50/50 border-rose-200/80 shadow-2xs'
                          : 'bg-slate-50 border-slate-200/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isVencido ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-xs truncate">
                            {item.pessoaNome || 'Fornecedor'}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono">{item.tituloCodigo || item.numeroDocumento || 'TÍTULO'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Venc: {formatDate(item.dataVencimento)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-rose-600 text-xs block">
                          {formatCurrency(item.saldoCentavos)}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase mt-0.5 ${
                            isVencido ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Pendente em Despesas</span>
            <span className="font-extrabold text-rose-600">{formatCurrency(totalPagarCentavos)}</span>
          </div>
        </div>

        {/* TABELA DE CONTAS A RECEBER MAIS IMPORTANTES / VENCENDO */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Contas a Receber Prioritárias</h3>
                  <p className="text-xs text-slate-400">Recebimentos esperados e cobranças ativas</p>
                </div>
              </div>

              <Link
                href="/contas-receber"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Carregando títulos a receber...</div>
            ) : titulosReceberUrgentes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Sem títulos a receber pendentes no momento.</div>
            ) : (
              <div className="space-y-3">
                {titulosReceberUrgentes.map((item) => {
                  const isVencido = item.status === 'vencido';
                  return (
                    <div
                      key={item.parcelaId}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isVencido
                          ? 'bg-amber-50/50 border-amber-200/80 shadow-2xs'
                          : 'bg-slate-50 border-slate-200/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isVencido ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-xs truncate">
                            {item.pessoaNome || 'Cliente'}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono">{item.tituloCodigo || item.numeroDocumento || 'TÍTULO'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Venc: {formatDate(item.dataVencimento)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-emerald-600 text-xs block">
                          {formatCurrency(item.saldoCentavos)}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase mt-0.5 ${
                            isVencido ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Pendente em Receitas</span>
            <span className="font-extrabold text-emerald-600">{formatCurrency(totalReceberCentavos)}</span>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE INFORMAÇÕES FINANCEIRAS: BANCOS & CENTROS DE CUSTO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CARD DE CONTAS BANCÁRIAS E SALDOS */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-slate-800 text-sm">Contas Bancárias & Caixas</h3>
            </div>
            <Link href="/contas-bancarias" className="text-xs font-semibold text-purple-600 hover:underline">
              Gerenciar
            </Link>
          </div>

          {contasBancarias.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">Nenhuma conta bancária cadastrada.</div>
          ) : (
            <div className="space-y-3">
              {contasBancarias.map((banco) => (
                <div key={banco.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                      {banco.banco ? banco.banco.substring(0, 2).toUpperCase() : 'BC'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{banco.nome}</p>
                      <p className="text-slate-400 text-[11px]">{banco.banco || 'Banco'} • Ag {banco.agencia || '0001'}</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-800">
                    {formatCurrency(banco.saldoInicialCentavos || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CARD DE CONSUMO DO CENTRO DE CUSTOS */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-slate-800 text-sm">Consumo de Orçamento / CC</h3>
            </div>
            <Link href="/centro-custos" className="text-xs font-semibold text-purple-600 hover:underline">
              Ver todos
            </Link>
          </div>

          {centrosCusto.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">Nenhum centro de custo encontrado.</div>
          ) : (
            <div className="space-y-3">
              {centrosCusto.slice(0, 3).map((cc) => {
                const orcamento = cc.orcamentoCentavos || 10000000;
                const gasto = cc.gastoCentavos || 4500000;
                const perc = Math.min(Math.round((gasto / orcamento) * 100), 100);
                return (
                  <div key={cc.id} className="space-y-1.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-800 truncate">{cc.nome}</span>
                      <span className="text-slate-500 font-mono">{perc}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          perc > 90 ? 'bg-rose-500' : perc > 75 ? 'bg-amber-500' : 'bg-purple-600'
                        }`}
                        style={{ width: `${perc}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Gasto: {formatCurrency(gasto)}</span>
                      <span>Orçado: {formatCurrency(orcamento)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CARD DE SAÚDE E RECOMENDAÇÕES FINANCEIRAS */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm">Resumo da Saúde Financeira</h3>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Índice de Liquidez Corrente</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                A empresa possui R$ {(totalReceberCentavos / Math.max(totalPagarCentavos, 1)).toFixed(2)} de receita a receber para cada R$ 1,00 a pagar no período.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Status de Inadimplência</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                {totalVencidoReceberCentavos > 0
                  ? `Existem ${formatCurrency(totalVencidoReceberCentavos)} em recebimentos com atraso sujeitos a cobrança.`
                  : 'Nenhum atraso significativo detectado na carteira de recebimentos.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
