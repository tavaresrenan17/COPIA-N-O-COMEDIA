'use client';

import React, { useEffect, useState } from 'react';
import { 
  erpRepository, 
  ParcelaView, 
  Pessoa, 
  CentroCusto, 
  PlanoConta, 
  StatusParcela, 
  TipoTitulo,
  Movimento 
} from '@/data';
import { formatCurrency } from '@/lib/formatters';
import Link from 'next/link';
import { BaixaParcelaModal } from './BaixaParcelaModal';
import { BaixaEmLoteModal } from './BaixaEmLoteModal';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Layers,
  RotateCcw,
  DollarSign,
  Pencil,
  Trash2,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from './ui/Modal';
import { useToast } from './ui/ToastProvider';

interface GestaoParcelasPageProps {
  tipo: TipoTitulo; // 'P' = Pagar, 'R' = Receber
}

interface TituloGroup {
  tituloId: string;
  tituloCodigo: string;
  pessoaNome: string;
  descricao: string;
  valorBrutoCentavos: number;
  saldoTotalCentavos: number;
  dataVencimento: string;
  statusConsolidado: StatusParcela;
  diasAtrasoMax: number;
  qtdParcelas: number;
  /** Título com baixa lançada não pode ser alterado nem excluído. */
  temBaixa: boolean;
  parcelas: ParcelaView[];
}

export function GestaoParcelasPage({ tipo }: GestaoParcelasPageProps) {
  const toast = useToast();
  const [parcelas, setParcelas] = useState<ParcelaView[]>([]);
  const [loading, setLoading] = useState(true);

  // Listas para os filtros
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [planosConta, setPlanosConta] = useState<PlanoConta[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | 'TODOS'>('TODOS');
  const [filtroPessoaId, setFiltroPessoaId] = useState('');
  const [filtroCentroCustoId, setFiltroCentroCustoId] = useState('');
  const [filtroPlanoContaId, setFiltroPlanoContaId] = useState('');
  const [dataVencimentoDe, setDataVencimentoDe] = useState('');
  const [dataVencimentoAte, setDataVencimentoAte] = useState('');

  // Seleção Múltipla (Baixa em Lote)
  const [selectedParcelaIds, setSelectedParcelaIds] = useState<string[]>([]);

  // Expansão do Título (Parcelas divididas)
  const [expandedTituloId, setExpandedTituloId] = useState<string | null>(null);

  // Exclusão de título
  const [tituloParaExcluir, setTituloParaExcluir] = useState<TituloGroup | null>(null);
  const [excluindoTitulo, setExcluindoTitulo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  // Modais
  const [baixaIndividualModalOpen, setBaixaIndividualModalOpen] = useState(false);
  const [parcelaEmBaixa, setParcelaEmBaixa] = useState<ParcelaView | null>(null);
  const [baixaEmLoteModalOpen, setBaixaEmLoteModalOpen] = useState(false);

  const isRecebimento = tipo === 'R';

  // Termo de busca "estabilizado": o input responde a cada tecla, mas a consulta
  // só dispara depois de 400ms sem digitação. Antes, cada tecla disparava um
  // getParcelasView completo (~0,5s de ida e volta ao Supabase por caractere).
  const [searchDebounced, setSearchDebounced] = useState(searchTerm);
  const requisicaoAtual = React.useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadAuxiliaryData();
  }, [tipo]);

  useEffect(() => {
    loadParcelas();
    setSelectedParcelaIds([]);
  }, [
    tipo,
    searchDebounced,
    filtroStatus,
    filtroPessoaId,
    filtroCentroCustoId,
    filtroPlanoContaId,
    dataVencimentoDe,
    dataVencimentoAte
  ]);

  async function loadAuxiliaryData() {
    const [pList, ccList, pcList] = await Promise.all([
      erpRepository.getPessoas({
        apenasAtivos: true,
        apenasClientes: isRecebimento,
        apenasFornecedores: !isRecebimento
      }),
      erpRepository.getCentrosCusto({ apenasAtivos: true }),
      erpRepository.getPlanoContasFolhas(isRecebimento ? 'receita' : undefined)
    ]);
    setPessoas(pList);
    setCentrosCusto(ccList);
    setPlanosConta(pcList);
  }

  async function loadParcelas() {
    // Consultas concorrentes podem voltar fora de ordem (a de um filtro antigo
    // chegando depois da atual). Num sistema financeiro isso mostraria a lista
    // errada, então só a resposta mais recente tem permissão de pintar a tela.
    const reqId = ++requisicaoAtual.current;
    setLoading(true);
    try {
      const data = await erpRepository.getParcelasView(tipo, {
        apenasAtivos: true,
        searchTerm: searchDebounced || undefined,
        status: filtroStatus === 'TODOS' ? undefined : filtroStatus,
        pessoaId: filtroPessoaId || undefined,
        centroCustoId: filtroCentroCustoId || undefined,
        planoContaId: filtroPlanoContaId || undefined,
        dataVencimentoDe: dataVencimentoDe || undefined,
        dataVencimentoAte: dataVencimentoAte || undefined,
      });
      if (reqId !== requisicaoAtual.current) return;
      setParcelas(data);
    } finally {
      if (reqId === requisicaoAtual.current) setLoading(false);
    }
  }

  // Agrupamento por Título Único (1 linha por Título na tabela principal)
  const tituloGroups = React.useMemo(() => {
    const map = new Map<string, ParcelaView[]>();
    for (const p of parcelas) {
      const list = map.get(p.tituloId) || [];
      list.push(p);
      map.set(p.tituloId, list);
    }

    const groups: TituloGroup[] = [];

    map.forEach((list, tituloId) => {
      list.sort((a, b) => a.parcelaNumero - b.parcelaNumero);

      const first = list[0];
      const valorBrutoCentavos = list.reduce((acc, p) => acc + p.valorCentavos, 0);
      const saldoTotalCentavos = list.reduce((acc, p) => acc + p.saldoCentavos, 0);

      const pendente = list.find(p => p.status !== 'pago' && p.status !== 'cancelado') || list[0];

      const todasPagas = list.every(p => p.status === 'pago');
      const temVencida = list.some(p => p.status === 'vencido');
      const temPagaOuParcial = list.some(p => p.status === 'pago' || p.status === 'parcial' || p.saldoCentavos < p.valorCentavos);

      let statusConsolidado: StatusParcela = 'aberto';
      if (todasPagas) {
        statusConsolidado = 'pago';
      } else if (temVencida) {
        statusConsolidado = 'vencido';
      } else if (temPagaOuParcial) {
        statusConsolidado = 'parcial';
      } else {
        statusConsolidado = 'aberto';
      }

      const maxAtraso = Math.max(...list.map(p => p.diasAtraso || 0));

      groups.push({
        tituloId,
        tituloCodigo: first.tituloCodigo.replace(/^TIT-/, ''), // Código numérico sequencial limpo (ex: 010003)
        pessoaNome: first.pessoaNome,
        descricao: first.descricao || '',
        valorBrutoCentavos,
        saldoTotalCentavos,
        dataVencimento: pendente.dataVencimento,
        statusConsolidado,
        diasAtrasoMax: maxAtraso,
        qtdParcelas: first.qtdParcelas || list.length,
        temBaixa: list.some(p => p.valorBaixadoCentavos > 0),
        parcelas: list
      });
    });

    groups.sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
    return groups;
  }, [parcelas]);

  const selectedParcelasObjs = parcelas.filter(p => selectedParcelaIds.includes(p.parcelaId));

  const handleExcluirTitulo = async () => {
    if (!tituloParaExcluir || excluindoTitulo) return;
    setExcluindoTitulo(true);
    setErroExclusao(null);
    try {
      const codigo = tituloParaExcluir.tituloCodigo;
      await erpRepository.deleteTitulo(tituloParaExcluir.tituloId);
      setTituloParaExcluir(null);
      toast.success('Título excluído', {
        description: `${codigo} — ${tituloParaExcluir.pessoaNome}`,
      });
      await loadParcelas();
    } catch (err) {
      setErroExclusao(err instanceof Error ? err.message : 'Não foi possível excluir o título.');
    } finally {
      setExcluindoTitulo(false);
    }
  };

  const getStatusBadge = (status: StatusParcela) => {
    switch (status) {
      case 'pago':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isRecebimento ? 'Recebido' : 'Pago'}
          </span>
        );
      case 'vencido':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Vencido
          </span>
        );
      case 'parcial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Parcial
          </span>
        );
      case 'aberto':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" />
            Aberto
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Ação de Novo Lançamento */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-wider ${isRecebimento ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isRecebimento ? 'Contas a Receber' : 'Contas a Pagar'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">
            {isRecebimento ? 'Gestão de Títulos de Recebimento' : 'Gestão de Títulos de Pagamento'}
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Cada linha representa 1 Título único no sistema. Clique para ver a divisão de suas parcelas.
          </p>
        </div>

        <Link
          href={isRecebimento ? '/contas-receber/cadastro' : '/contas-pagar/cadastro'}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>{isRecebimento ? 'Novo Título a Receber' : 'Novo Título a Pagar'}</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">Total dos Títulos</span>
          <div className="text-lg font-bold font-mono text-ink-primary">
            {formatCurrency(tituloGroups.reduce((acc, t) => acc + t.valorBrutoCentavos, 0))}
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">Saldo em Aberto</span>
          <div className="text-lg font-bold font-mono text-amber-600">
            {formatCurrency(tituloGroups.reduce((acc, t) => acc + t.saldoTotalCentavos, 0))}
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">Vencido</span>
          <div className="text-lg font-bold font-mono text-rose-600">
            {formatCurrency(
              tituloGroups
                .filter(t => t.statusConsolidado === 'vencido')
                .reduce((acc, t) => acc + t.saldoTotalCentavos, 0)
            )}
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">Liquidado / Pago</span>
          <div className="text-lg font-bold font-mono text-emerald-600">
            {formatCurrency(
              tituloGroups
                .filter(t => t.statusConsolidado === 'pago')
                .reduce((acc, t) => acc + t.valorBrutoCentavos, 0)
            )}
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-surface rounded-2xl p-4 shadow-soft border border-black/[0.03] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isRecebimento ? "Buscar cliente, código..." : "Buscar fornecedor, código..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-muted border border-black/10 rounded-xl pl-9 pr-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as any)}
            className="bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="aberto">Aberto</option>
            <option value="vencido">Vencido</option>
            <option value="parcial">Parcial</option>
            <option value="pago">{isRecebimento ? 'Recebido' : 'Pago'}</option>
          </select>


          <select
            value={filtroPessoaId}
            onChange={(e) => setFiltroPessoaId(e.target.value)}
            className="bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">{isRecebimento ? 'Todos os Clientes' : 'Todos os Fornecedores'}</option>
            {pessoas.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-black/5 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-muted whitespace-nowrap">Vencimento:</span>
            <input
              type="date"
              value={dataVencimentoDe}
              onChange={(e) => setDataVencimentoDe(e.target.value)}
              className="w-full bg-surface-muted border border-black/10 rounded-xl px-2.5 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <span className="text-xs text-ink-muted">até</span>
            <input
              type="date"
              value={dataVencimentoAte}
              onChange={(e) => setDataVencimentoAte(e.target.value)}
              className="w-full bg-surface-muted border border-black/10 rounded-xl px-2.5 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <select
              value={filtroPlanoContaId}
              onChange={(e) => setFiltroPlanoContaId(e.target.value)}
              className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Todos os Planos de Conta</option>
              {planosConta.map(pc => (
                <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFiltroStatus('TODOS');
                setFiltroPessoaId('');
                setFiltroCentroCustoId('');
                setFiltroPlanoContaId('');
                setDataVencimentoDe('');
                setDataVencimentoAte('');
              }}
              className="px-3 py-1.5 bg-surface-muted hover:bg-black/5 text-ink-muted text-xs font-semibold rounded-xl border border-black/5"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabela Principal — 1 Linha por Título Único */}
      <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-ink-muted font-medium">Carregando títulos...</div>
        ) : tituloGroups.length === 0 ? (
          <div className="p-12 text-center text-ink-muted">Nenhum título encontrado para estes filtros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-muted text-[11px] font-bold uppercase tracking-wider text-ink-muted border-b border-black/[0.05]">
                  <th className="py-3.5 px-4 font-mono">Código</th>
                  <th className="py-3.5 px-4">Vencimento</th>
                  <th className="py-3.5 px-4">{isRecebimento ? 'Devedor' : 'Credor'}</th>
                  <th className="py-3.5 px-4">Descrição</th>
                  <th className="py-3.5 px-4 text-right">Valor Total</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03] text-xs font-medium text-ink-primary">
                {tituloGroups.map((tg) => {
                  const isVencido = tg.statusConsolidado === 'vencido';
                  const isExpanded = expandedTituloId === tg.tituloId;
                  const proximaPendente = tg.parcelas.find(p => p.status !== 'pago' && p.status !== 'cancelado');

                  return (
                    <React.Fragment key={tg.tituloId}>
                      <tr
                        onClick={() => setExpandedTituloId(isExpanded ? null : tg.tituloId)}
                        className={`transition-colors cursor-pointer ${
                          isVencido ? 'bg-rose-50/60 hover:bg-rose-50' : isExpanded ? 'bg-brand/5' : 'hover:bg-black/[0.01]'
                        }`}
                      >
                        {/* Código do Título Numérico Sequencial */}
                        <td className="py-3.5 px-4 font-mono">
                          <span className="inline-block px-3 py-1 rounded-lg bg-brand/10 text-brand font-bold text-xs font-mono">
                            {tg.tituloCodigo}
                          </span>
                        </td>

                        {/* Vencimento */}
                        <td className="py-3.5 px-4">
                          <span className={`font-bold font-mono ${isVencido ? 'text-rose-600' : 'text-ink-primary'}`}>
                            {tg.dataVencimento}
                          </span>
                          {tg.diasAtrasoMax > 0 && (
                            <span className="block text-[10px] font-bold text-rose-600">
                              {tg.diasAtrasoMax}d em atraso
                            </span>
                          )}
                        </td>

                        {/* Credor / Devedor */}
                        <td className="py-3.5 px-4 font-bold text-ink-primary">
                          {tg.pessoaNome}
                        </td>

                        {/* Descrição */}
                        <td className="py-3.5 px-4 max-w-sm">
                          <span className="truncate block font-semibold">{tg.descricao || 'Sem descrição'}</span>
                        </td>

                        {/* Valor Total */}
                        <td className={`py-3.5 px-4 text-right font-mono font-bold ${isVencido ? 'text-rose-600' : 'text-ink-primary'}`}>
                          {formatCurrency(tg.valorBrutoCentavos)}
                          {tg.saldoTotalCentavos > 0 && tg.saldoTotalCentavos < tg.valorBrutoCentavos && (
                            <span className="block text-[10px] text-amber-600 font-semibold">
                              Saldo: {formatCurrency(tg.saldoTotalCentavos)}
                            </span>
                          )}
                        </td>

                        {/* Status Consolidado */}
                        <td className="py-3.5 px-4 text-center">
                          {getStatusBadge(tg.statusConsolidado)}
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {proximaPendente && (
                              <button
                                onClick={() => {
                                  setParcelaEmBaixa(proximaPendente);
                                  setBaixaIndividualModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
                              >
                                {isRecebimento ? 'Dar Baixa' : 'Pagar'}
                              </button>
                            )}

                            {tg.temBaixa ? (
                              <span
                                title="Título com baixa lançada — estorne as baixas para poder alterar ou excluir"
                                className="p-1.5 text-ink-muted/40 cursor-not-allowed"
                              >
                                <Lock className="w-4 h-4" />
                              </span>
                            ) : (
                              <>
                                <Link
                                  href={`${isRecebimento ? '/contas-receber' : '/contas-pagar'}/cadastro/${tg.tituloId}`}
                                  title="Editar título"
                                  aria-label={`Editar título ${tg.tituloCodigo}`}
                                  className="p-1.5 text-ink-muted hover:text-brand rounded-lg hover:bg-brand/10 transition-all"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Link>

                                <button
                                  onClick={() => setTituloParaExcluir(tg)}
                                  title="Excluir título"
                                  aria-label={`Excluir título ${tg.tituloCodigo}`}
                                  className="p-1.5 text-ink-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => setExpandedTituloId(isExpanded ? null : tg.tituloId)}
                              className="p-1.5 text-ink-muted hover:text-brand rounded-lg hover:bg-black/5 transition-all flex items-center gap-1 text-[11px] font-bold"
                            >
                              <span>{tg.qtdParcelas > 1 ? `${tg.qtdParcelas}x` : ''}</span>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* GAVETA DE PARCELAS DIVIDIDAS DO TÍTULO */}
                      {isExpanded && (
                        <tr className="bg-surface-muted border-b border-black/5">
                          <td colSpan={7} className="p-4">
                            <div className="bg-surface rounded-2xl p-4 border border-black/10 space-y-3 shadow-sm">
                              <div className="flex items-center justify-between border-b border-black/5 pb-2">
                                <h4 className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-2">
                                  <Layers className="w-4 h-4" />
                                  <span>Parcelamento Dividido do Título #{tg.tituloCodigo} ({tg.qtdParcelas} Parcela(s))</span>
                                </h4>
                                <div className="text-[11px] text-ink-muted space-x-3">
                                  <span>Total: <strong>{formatCurrency(tg.valorBrutoCentavos)}</strong></span>
                                  <span>•</span>
                                  <span>Saldo em Aberto: <strong className="text-amber-600">{formatCurrency(tg.saldoTotalCentavos)}</strong></span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {tg.parcelas.map((parc) => (
                                  <div
                                    key={parc.parcelaId}
                                    className="bg-surface-muted p-3 rounded-xl border border-black/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="font-bold text-brand font-mono bg-brand/10 px-2 py-0.5 rounded">
                                        Parcela {parc.parcelaNumero}/{tg.qtdParcelas}
                                      </span>
                                      <span className="font-semibold text-ink-primary">Vencimento: {parc.dataVencimento}</span>
                                      <span className="font-mono text-ink-muted font-bold">{formatCurrency(parc.valorCentavos)}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {getStatusBadge(parc.status)}
                                      {parc.status !== 'pago' && parc.status !== 'cancelado' && (
                                        <button
                                          onClick={() => {
                                            setParcelaEmBaixa(parc);
                                            setBaixaIndividualModalOpen(true);
                                          }}
                                          className="px-2.5 py-1 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                                        >
                                          {isRecebimento ? 'Dar Baixa' : 'Pagar Parcela'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
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

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE TÍTULO */}
      <Modal
        isOpen={tituloParaExcluir !== null}
        onClose={() => {
          setTituloParaExcluir(null);
          setErroExclusao(null);
        }}
        dismissible={!excluindoTitulo}
        title="Excluir título?"
        size="md"
        icon={
          <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Trash2 className="w-5 h-5" aria-hidden />
          </span>
        }
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setTituloParaExcluir(null);
                setErroExclusao(null);
              }}
              disabled={excluindoTitulo}
              className="px-4 py-2 rounded-[10px] text-xs text-ink-muted hover:text-ink-primary hover:bg-black/5 font-semibold focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExcluirTitulo}
              disabled={excluindoTitulo}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[10px] text-xs font-bold shadow-md focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {excluindoTitulo ? 'Excluindo...' : 'Excluir Título'}
            </button>
          </div>
        }
      >
        {tituloParaExcluir && (
          <div className="space-y-4">
            <p className="text-xs text-ink-muted leading-relaxed">
              O título{' '}
              <strong className="font-mono text-ink-primary">{tituloParaExcluir.tituloCodigo}</strong> de{' '}
              <strong className="text-ink-primary">{tituloParaExcluir.pessoaNome}</strong> será desativado
              junto com suas {tituloParaExcluir.qtdParcelas} parcela(s), somando{' '}
              <strong className="text-ink-primary">
                {formatCurrency(tituloParaExcluir.valorBrutoCentavos)}
              </strong>
              .
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Ele sai das listagens, do fluxo de caixa e do consumo orçamentário. Nenhuma baixa foi
                lançada neste título, então o caixa não é afetado.
              </p>
            </div>

            {erroExclusao && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-px" aria-hidden />
                <p className="text-[11px] text-rose-800 font-semibold">{erroExclusao}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* MODAIS */}
      <BaixaParcelaModal
        parcela={parcelaEmBaixa}
        isOpen={baixaIndividualModalOpen}
        onClose={() => {
          setBaixaIndividualModalOpen(false);
          setParcelaEmBaixa(null);
        }}
        onSuccess={() => loadParcelas()}
      />

      <BaixaEmLoteModal
        tipo={tipo}
        parcelasSelecionadas={selectedParcelasObjs}
        isOpen={baixaEmLoteModalOpen}
        onClose={() => setBaixaEmLoteModalOpen(false)}
        onSuccess={() => {
          setSelectedParcelaIds([]);
          loadParcelas();
        }}
      />
    </div>
  );
}
