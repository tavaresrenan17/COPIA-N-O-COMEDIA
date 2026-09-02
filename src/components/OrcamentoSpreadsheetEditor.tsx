'use client';

import React, { useState, useEffect } from 'react';
import {
  PlanoConta, 
  CentroCusto, 
  TipoCentroCusto,
  erpRepository, 
  ComprometidoTituloItem, 
  RealizadoMovimentoItem 
} from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { proximoCodigo } from '@/lib/codigos';
import { aceitaUnidadeLivre } from '@/lib/centroCusto';
import { 
  Plus, 
  Trash2, 
  Lock, 
  Save, 
  X, 
  Building2, 
  Check, 
  TrendingUp, 
  DollarSign,
  PieChart,
  ChevronDown,
  ChevronRight,
  Eye,
  Receipt,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Search
} from 'lucide-react';

export interface GridRowItem {
  id: string;
  /** Código do item na planilha ("1.1"). */
  codigo: string;
  planoContaId?: string;
  /** Unidade Construtiva do item (ENGENHARIA, MÃO DE OBRA, IMPOSTOS, TORRE 1...). */
  centroCustoId?: string;
  /** Nome / Descrição do Item do Orçamento. */
  descricao: string;
  /** Valor Esperado em Reais digitado pelo engenheiro (ex: "500,00"). */
  valorEsperadoReais: string;
  /** Valor Esperado em centavos inteiros. */
  valorEsperadoCentavos: number;
  /** Total Pago / Baixado acumulado em títulos apropriados. */
  totalPagoCentavos?: number;
  /** Total Comprometido / A Pagar em aberto. */
  totalComprometidoCentavos?: number;
  /** Saldo Restante / Disponível do item. */
  saldoCentavos?: number;
  /** % Consumido do orçamento. */
  percentualConsumido?: number;
  /** Lista detalhada de títulos comprometidos / a pagar */
  comprometidoTitulos?: ComprometidoTituloItem[];
  /** Lista detalhada de movimentos de caixa pagos */
  realizadoMovimentos?: RealizadoMovimentoItem[];
}

interface OrcamentoSpreadsheetEditorProps {
  dataInicio?: string;
  dataFim?: string;
  planosNivel2?: PlanoConta[];
  /** Unidades Construtivas da obra deste orçamento. */
  subCentrosCusto?: CentroCusto[];
  obraId?: string;
  obraNome?: string;
  /**
   * Tipo do centro de custo vinculado ao orçamento. Decide se "Nova Unidade
   * Construtiva" faz sentido aqui — ver `podeCriarUnidade`.
   */
  obraTipo?: TipoCentroCusto;
  orcamentoId?: string;
  initialItens?: any[];
  isReadonly?: boolean;
  onNovaUnidade?: (nova: CentroCusto) => void;
  onSave: (itens: {
    id?: string;
    codigo?: string;
    planoContaId?: string;
    centroCustoId?: string;
    descricao?: string;
    quantidade?: number;
    unidade?: string;
    valorUnitarioCentavos?: number;
    valorTotalCentavos: number;
    periodos?: { mesReferencia: string; valorCentavos: number }[];
  }[]) => Promise<void>;
  onCancel?: () => void;
}

export function OrcamentoSpreadsheetEditor({
  planosNivel2 = [],
  subCentrosCusto = [],
  obraId,
  obraNome,
  obraTipo,
  orcamentoId,
  initialItens = [],
  isReadonly = false,
  onNovaUnidade,
  onSave,
  onCancel
}: OrcamentoSpreadsheetEditorProps) {
  const [rows, setRows] = useState<GridRowItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [unidadesLocais, setUnidadesLocais] = useState<CentroCusto[]>(subCentrosCusto);
  const [modalNovaUnidadeOpen, setModalNovaUnidadeOpen] = useState(false);
  const [nomeNovaUnidade, setNomeNovaUnidade] = useState('');
  const [criandoUnidade, setCriandoUnidade] = useState(false);

  // Estados de visualização das Apropriações
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [modalApropriacaoRow, setModalApropriacaoRow] = useState<GridRowItem | null>(null);
  const [modalTab, setModalTab] = useState<'todos' | 'comprometido' | 'realizado'>('todos');
  const [modalSearch, setModalSearch] = useState('');

  /*
   * Unidade Construtiva à mão só no híbrido `centro_custo_obra`.
   *
   * O tipo `obra` tem lista FIXA — as unidades nascem com a obra e a lista é
   * fechada, então criar mais uma aqui contraria a regra. E o orçamento se
   * prende a qualquer centro de custo raiz (a tela de Orçamentos monta a
   * lista por `!cc.parentId`, sem olhar o tipo), então sem esta guarda o
   * botão também aparecia em centro de custo administrativo, de frota ou
   * comercial — que não têm unidade construtiva nenhuma.
   */
  const podeCriarUnidade = !isReadonly && aceitaUnidadeLivre(obraTipo);

  useEffect(() => {
    setUnidadesLocais(subCentrosCusto);
  }, [subCentrosCusto]);

  useEffect(() => {
    async function carregarExecucaoEItens() {
      const execucaoMap = new Map<string, { 
        realizado: number; 
        comprometido: number; 
        saldo: number; 
        percentual: number;
        comprometidoTitulos?: ComprometidoTituloItem[];
        realizadoMovimentos?: RealizadoMovimentoItem[];
      }>();
      
      if (orcamentoId) {
        try {
          const exec = await erpRepository.getOrcamentoExecucao(orcamentoId);
          if (exec && exec.itensExecucao) {
            exec.itensExecucao.forEach((it, idx) => {
              const data = {
                realizado: it.realizadoCentavos,
                comprometido: it.comprometidoCentavos,
                saldo: it.saldoCentavos,
                percentual: it.percentualConsumido,
                comprometidoTitulos: it.comprometidoTitulos || [],
                realizadoMovimentos: it.realizadoMovimentos || []
              };
              if (it.itemId) execucaoMap.set(it.itemId, data);
              if (it.itemCodigo) execucaoMap.set(`code:${it.itemCodigo}`, data);
              if (it.itemDescricao) execucaoMap.set(`desc:${it.itemDescricao.trim().toLowerCase()}`, data);
              if (it.centroCustoId) execucaoMap.set(`cc:${it.centroCustoId}`, data);
              execucaoMap.set(`idx:${idx}`, data);
            });
          }
        } catch {
          // Continua com valores padrão se não carregar execução
        }
      }

      if (initialItens && initialItens.length > 0) {
        const convertedRows: GridRowItem[] = initialItens.map((it, idx) => {
          const vtCentavos = it.valorTotalCentavos || 0;
          const exec = (it.id ? execucaoMap.get(it.id) : undefined)
            || (it.codigo ? execucaoMap.get(`code:${it.codigo}`) : undefined)
            || (it.descricao ? execucaoMap.get(`desc:${it.descricao.trim().toLowerCase()}`) : undefined)
            || (it.centroCustoId ? execucaoMap.get(`cc:${it.centroCustoId}`) : undefined)
            || execucaoMap.get(`idx:${idx}`);
          const totalPago = exec ? exec.realizado : 0;
          const totalComp = exec ? exec.comprometido : 0;
          const saldo = exec ? exec.saldo : (vtCentavos - totalPago - totalComp);
          const consumido = totalPago + totalComp;
          const pct = vtCentavos > 0 ? (consumido / vtCentavos) * 100 : 0;

          return {
            id: it.id || `row-${Date.now()}-${idx}`,
            codigo: it.codigo || '',
            planoContaId: it.planoContaId || it.planoContaNivel2Id || (planosNivel2[0]?.id || ''),
            centroCustoId: it.centroCustoId,
            descricao: it.descricao || '',
            valorEsperadoReais: vtCentavos > 0 ? (vtCentavos / 100).toFixed(2).replace('.', ',') : '',
            valorEsperadoCentavos: vtCentavos,
            totalPagoCentavos: totalPago,
            totalComprometidoCentavos: totalComp,
            saldoCentavos: saldo,
            percentualConsumido: pct,
            comprometidoTitulos: exec?.comprometidoTitulos || [],
            realizadoMovimentos: exec?.realizadoMovimentos || []
          };
        });
        setRows(convertedRows);
      } else {
        setRows([criarNovaLinhaVazia()]);
      }
    }

    carregarExecucaoEItens();
  }, [orcamentoId, initialItens]);

  function toggleRowExpand(rowId: string) {
    setExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  }

  function abrirModalApropriacoes(row: GridRowItem, tab: 'todos' | 'comprometido' | 'realizado' = 'todos') {
    setModalApropriacaoRow(row);
    setModalTab(tab);
    setModalSearch('');
  }

  function criarNovaLinhaVazia(): GridRowItem {
    const pcDef = planosNivel2[0]?.id || '';
    return {
      id: `row-${Date.now()}-${Math.random()}`,
      codigo: '',
      planoContaId: pcDef,
      centroCustoId: undefined,
      descricao: '',
      valorEsperadoReais: '',
      valorEsperadoCentavos: 0,
      totalPagoCentavos: 0,
      totalComprometidoCentavos: 0,
      saldoCentavos: 0,
      percentualConsumido: 0,
      comprometidoTitulos: [],
      realizadoMovimentos: []
    };
  }

  function handleAddRow() {
    if (isReadonly) return;
    setRows(prev => [...prev, criarNovaLinhaVazia()]);
  }

  function handleRemoveRow(id: string) {
    if (isReadonly) return;
    if (rows.length === 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function handleRowFieldChange(rowId: string, field: keyof GridRowItem, value: any) {
    if (isReadonly) return;

    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      const updated = { ...row, [field]: value };

      if (field === 'valorEsperadoReais') {
        const rawStr = String(value).replace(/\./g, '').replace(',', '.');
        const vtNum = parseFloat(rawStr) || 0;
        updated.valorEsperadoCentavos = Math.round(vtNum * 100);
        const pago = updated.totalPagoCentavos || 0;
        const comp = updated.totalComprometidoCentavos || 0;
        updated.saldoCentavos = updated.valorEsperadoCentavos - pago - comp;
        const consumido = pago + comp;
        updated.percentualConsumido = updated.valorEsperadoCentavos > 0 ? (consumido / updated.valorEsperadoCentavos) * 100 : 0;
      }

      return updated;
    }));
  }

  async function handleCriarUnidadeRapida(nome: string) {
    if (!nome.trim() || !podeCriarUnidade) return;
    setCriandoUnidade(true);
    try {
      const todos = await erpRepository.getCentrosCusto({ apenasAtivos: false });
      const parentObra = obraId ? todos.find(c => c.id === obraId) : null;
      const cod = proximoCodigo(todos, parentObra as any);

      const nova = await erpRepository.createCentroCusto({
        codigo: cod,
        nome: nome.trim(),
        parentId: obraId || undefined,
        tipo: 'obra',
        nivel: parentObra ? parentObra.nivel + 1 : 1,
        aceitaLancamento: true,
        ativo: true,
      });

      setUnidadesLocais(prev => [...prev, nova]);
      if (onNovaUnidade) onNovaUnidade(nova);
      setNomeNovaUnidade('');
      setModalNovaUnidadeOpen(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar unidade construtiva.');
    }
    setCriandoUnidade(false);
  }

  async function handleSalvarSubmit() {
    if (isReadonly) return;

    setSaving(true);
    try {
      const pcPadrao = planosNivel2[0]?.id || '';
      const payload = rows.map(r => ({
        id: r.id,
        codigo: r.codigo.trim() || undefined,
        planoContaId: r.planoContaId || pcPadrao,
        centroCustoId: r.centroCustoId || undefined,
        descricao: r.descricao.trim() || 'Item Orçado',
        valorTotalCentavos: r.valorEsperadoCentavos,
        periodos: []
      }));

      await onSave(payload);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar orçamento.');
    }
    setSaving(false);
  }

  // Totais Gerais
  const totalGeralEsperadoCentavos = rows.reduce((s, r) => s + r.valorEsperadoCentavos, 0);
  const totalGeralPagoCentavos = rows.reduce((s, r) => s + (r.totalPagoCentavos || 0), 0);
  const totalGeralComprometidoCentavos = rows.reduce((s, r) => s + (r.totalComprometidoCentavos || 0), 0);
  const totalGeralSaldoCentavos = totalGeralEsperadoCentavos - totalGeralPagoCentavos - totalGeralComprometidoCentavos;

  function getSemaforoBadge(pct: number) {
    if (pct > 100) return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300 shadow-xs whitespace-nowrap shrink-0">🔴 Estourado</span>;
    if (pct >= 80) return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 shadow-xs whitespace-nowrap shrink-0">🟡 Alerta</span>;
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 shadow-xs whitespace-nowrap shrink-0">🟢 Normal</span>;
  }

  return (
    <div className="space-y-4">
      {/* BARRA DE AÇÕES DO EDITOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-muted p-4 rounded-2xl border border-black/5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-primary flex items-center gap-1.5">
            Orçamento de Obra (Valor Esperado)
            {isReadonly && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border border-amber-200">
                <Lock className="w-3 h-3" />
                Modo Leitura (Aprovado)
              </span>
            )}
          </span>
          <span className="text-xs text-ink-muted">
            • <strong>{rows.length}</strong> itens • Total Esperado: <strong className="text-brand font-mono">{formatCurrency(totalGeralEsperadoCentavos)}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {podeCriarUnidade && (
            <button
              type="button"
              onClick={() => setModalNovaUnidadeOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-surface border border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl text-xs font-semibold shadow-soft transition-all"
              title="Cadastrar nova Unidade Construtiva para esta obra"
            >
              <Building2 className="w-4 h-4 text-purple-600" />
              <span>+ Nova Unidade</span>
            </button>
          )}

          {!isReadonly && (
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-surface border border-black/10 text-ink-primary hover:bg-black/5 rounded-xl text-xs font-semibold shadow-soft transition-all"
            >
              <Plus className="w-4 h-4 text-brand" />
              <span>Adicionar Linha</span>
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-surface border border-black/10 text-ink-muted hover:text-ink-primary rounded-xl text-xs font-semibold"
            >
              Cancelar
            </button>
          )}

          {!isReadonly && (
            <button
              type="button"
              onClick={handleSalvarSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Orçamento'}</span>
            </button>
          )}
        </div>
      </div>

      {/* GRID INTERATIVO LIMPO */}
      <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.06] overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-muted border-b border-black/10 text-[11px] font-bold text-ink-muted uppercase sticky top-0 z-10">
              <th className="p-3 w-10 text-center"></th>
              <th className="p-3 w-24">Código</th>
              <th className="p-3 min-w-[180px]">Unidade Construtiva</th>
              <th className="p-3 min-w-[220px]">Item do Orçamento</th>
              <th className="p-3 min-w-[150px] text-right text-brand font-bold" title="Valor total previsto cadastrado pelo engenheiro">
                Valor Esperado (R$)
              </th>
              <th className="p-3 min-w-[140px] text-right text-emerald-700 bg-emerald-50/50">Total Pago (R$)</th>
              <th className="p-3 min-w-[140px] text-right text-amber-700 bg-amber-50/50">A Pagar (R$)</th>
              <th className="p-3 min-w-[160px] text-right text-ink-primary font-bold">Saldo em Aberto (R$)</th>
              <th className="p-3 min-w-[180px] text-center">% Consumido</th>
              <th className="p-3 min-w-[100px] text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 font-medium">
            {rows.map((row, rIdx) => {
              const pago = row.totalPagoCentavos || 0;
              const comp = row.totalComprometidoCentavos || 0;
              const saldo = row.saldoCentavos ?? (row.valorEsperadoCentavos - pago - comp);
              const pct = row.percentualConsumido || 0;
              const isExpanded = !!expandedRows[row.id];
              const totalLancamentos = (row.comprometidoTitulos?.length || 0) + (row.realizadoMovimentos?.length || 0);

              return (
                <React.Fragment key={row.id}>
                  <tr 
                    className={`transition-colors ${
                      saldo < 0 ? 'bg-rose-50/40' : isExpanded ? 'bg-brand/[0.03]' : rIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-muted/20'
                    }`}
                  >
                    {/* Botão de Expansão */}
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleRowExpand(row.id)}
                        title={isExpanded ? 'Recolher detalhes apropriados' : 'Expandir títulos e lançamentos apropriados nesta linha'}
                        className={`p-1 rounded-lg transition-colors ${
                          isExpanded ? 'bg-brand/10 text-brand' : 'text-ink-muted hover:bg-black/5 hover:text-ink-primary'
                        }`}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* 1. Código do item */}
                    <td className="p-2.5">
                      {isReadonly ? (
                        <span className="font-mono font-bold text-ink-primary">{row.codigo || '-'}</span>
                      ) : (
                        <input
                          type="text"
                          placeholder="1.1"
                          value={row.codigo}
                          onChange={(e) => handleRowFieldChange(row.id, 'codigo', e.target.value)}
                          className="w-full bg-surface border border-black/10 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-ink-primary focus:ring-2 focus:ring-brand"
                        />
                      )}
                    </td>

                    {/* 2. Unidade Construtiva */}
                    <td className="p-2.5">
                      {isReadonly ? (
                        <span className="text-ink-primary font-bold">
                          {unidadesLocais.find(c => c.id === row.centroCustoId)?.nome || 'Toda a obra'}
                        </span>
                      ) : (
                        <select
                          value={row.centroCustoId || ''}
                          onChange={(e) => handleRowFieldChange(row.id, 'centroCustoId', e.target.value)}
                          className="w-full bg-surface border border-black/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-primary focus:ring-2 focus:ring-brand"
                        >
                          <option value="">Toda a obra</option>
                          {unidadesLocais.map(c => (
                            <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* 3. Item do Orçamento */}
                    <td className="p-2.5">
                      {isReadonly ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-ink-primary font-semibold">{row.descricao || '-'}</span>
                          {totalLancamentos > 0 && (
                            <span 
                              onClick={() => abrirModalApropriacoes(row, 'todos')}
                              title="Clique para ver os lançamentos apropriados"
                              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand border border-brand/20 cursor-pointer hover:bg-brand/20 transition-all"
                            >
                              {totalLancamentos}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Ex: CARRO + COMBUSTÍVEL, MÃO DE OBRA, CONCRETO..."
                            value={row.descricao}
                            onChange={(e) => handleRowFieldChange(row.id, 'descricao', e.target.value)}
                            className="w-full bg-surface border border-black/10 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-primary focus:ring-2 focus:ring-brand"
                          />
                          {totalLancamentos > 0 && (
                            <button
                              type="button"
                              onClick={() => abrirModalApropriacoes(row, 'todos')}
                              title={`${totalLancamentos} lançamentos apropriados nesta linha`}
                              className="shrink-0 px-1.5 py-1 rounded-lg text-[10px] font-bold bg-brand/10 text-brand border border-brand/20 hover:bg-brand hover:text-white transition-all flex items-center gap-1"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>{totalLancamentos}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 4. Valor Esperado (R$) */}
                    <td className="p-2.5 text-right font-mono font-bold">
                      {isReadonly ? (
                        <span className="text-brand">{formatCurrency(row.valorEsperadoCentavos)}</span>
                      ) : (
                        <input
                          type="text"
                          placeholder="0,00"
                          value={row.valorEsperadoReais}
                          onChange={(e) => handleRowFieldChange(row.id, 'valorEsperadoReais', e.target.value)}
                          className="w-full text-right bg-surface border border-brand/30 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono text-brand focus:ring-2 focus:ring-brand shadow-xs"
                        />
                      )}
                    </td>

                    {/* 5. Total Pago (R$) */}
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                      <button
                        type="button"
                        onClick={() => abrirModalApropriacoes(row, 'realizado')}
                        title="Ver pagamentos efetivados apropriados neste item"
                        className="hover:underline hover:text-emerald-800 transition-colors inline-block"
                      >
                        {formatCurrency(pago)}
                      </button>
                    </td>

                    {/* 6. A Pagar (R$) */}
                    <td className="p-2.5 text-right font-mono font-bold text-amber-700 bg-amber-50/20">
                      <button
                        type="button"
                        onClick={() => abrirModalApropriacoes(row, 'comprometido')}
                        title="Ver títulos a pagar em aberto apropriados neste item"
                        className="hover:underline hover:text-amber-800 transition-colors inline-block"
                      >
                        {formatCurrency(comp)}
                      </button>
                    </td>

                    {/* 7. Saldo em Aberto / Restante (R$) */}
                    <td className={`p-2.5 text-right font-mono font-bold ${
                      saldo < 0 ? 'text-rose-600' : 'text-ink-primary'
                    }`}>
                      {formatCurrency(saldo)}
                    </td>

                    {/* 8. % Consumido & Status */}
                    <td className="p-3 text-center min-w-[180px]">
                      <div className="flex flex-col gap-1.5 w-full">
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="font-mono font-bold text-[11px] whitespace-nowrap text-ink-primary">{pct.toFixed(1)}%</span>
                          {getSemaforoBadge(pct)}
                        </div>
                        <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 rounded-full ${
                              pct > 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Coluna Ações */}
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => abrirModalApropriacoes(row, 'todos')}
                          title="Inspecionar todos os lançamentos apropriados nesta linha"
                          className="p-1.5 text-brand hover:bg-brand/10 rounded-lg transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!isReadonly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            title="Excluir Linha"
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* PAINEL EXPANSÍVEL INLINE DE APROPRIAÇÕES */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 border-b border-black/10">
                      <td colSpan={10} className="p-4 space-y-3">
                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-black/10 shadow-xs">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-brand" />
                            <span className="text-xs font-bold text-ink-primary">
                              Lançamentos Apropriados no Item: <strong className="text-brand">{row.codigo || ''} {row.descricao || 'Item sem nome'}</strong>
                            </span>
                            <span className="text-[11px] text-ink-muted bg-surface-muted px-2 py-0.5 rounded border border-black/5 font-semibold">
                              Unidade: {unidadesLocais.find(c => c.id === row.centroCustoId)?.nome || 'Toda a obra'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => abrirModalApropriacoes(row, 'todos')}
                            className="flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-hover hover:underline"
                          >
                            <span>Abrir visão detalhada</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* 1. Comprometido / A Pagar */}
                          <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 space-y-2.5 shadow-xs">
                            <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5 uppercase tracking-wide">
                                <Clock className="w-4 h-4 text-amber-600" />
                                Contas a Pagar / Em Aberto ({row.comprometidoTitulos?.length || 0})
                              </span>
                              <span className="font-mono font-bold text-xs text-amber-700">
                                {formatCurrency(comp)}
                              </span>
                            </div>

                            {!row.comprometidoTitulos || row.comprometidoTitulos.length === 0 ? (
                              <p className="text-[11px] text-ink-muted italic py-3 text-center">
                                Nenhum título a pagar em aberto apropriado para este item.
                              </p>
                            ) : (
                              <div className="overflow-x-auto max-h-56">
                                <table className="w-full text-left text-[11px]">
                                  <thead>
                                    <tr className="text-ink-muted border-b border-black/5 font-bold">
                                      <th className="p-1.5">Documento / Favorecido</th>
                                      <th className="p-1.5 text-center">Vencimento</th>
                                      <th className="p-1.5 text-right">% Rateio</th>
                                      <th className="p-1.5 text-right text-amber-700">Valor Apropriado</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-black/5 font-medium">
                                    {row.comprometidoTitulos.map((t, idx) => (
                                      <tr key={t.parcelaId || idx} className="hover:bg-amber-50/40">
                                        <td className="p-1.5">
                                          <span className="font-bold text-ink-primary block truncate max-w-[200px]">{t.pessoaNome}</span>
                                          <span className="text-[10px] text-ink-muted truncate block max-w-[200px]">
                                            Doc: {t.numeroDocumento || '-'} {t.descricao ? `• ${t.descricao}` : ''}
                                          </span>
                                        </td>
                                        <td className="p-1.5 text-center font-mono text-ink-muted">
                                          {t.dataVencimento ? t.dataVencimento.split('-').reverse().join('/') : '-'}
                                        </td>
                                        <td className="p-1.5 text-right font-mono text-ink-muted">
                                          {t.percentualRateio}%
                                        </td>
                                        <td className="p-1.5 text-right font-mono font-bold text-amber-700">
                                          {formatCurrency(t.valorRateadoCentavos)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* 2. Realizado / Pago */}
                          <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 space-y-2.5 shadow-xs">
                            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wide">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                Movimentos Pagos / Realizado ({row.realizadoMovimentos?.length || 0})
                              </span>
                              <span className="font-mono font-bold text-xs text-emerald-700">
                                {formatCurrency(pago)}
                              </span>
                            </div>

                            {!row.realizadoMovimentos || row.realizadoMovimentos.length === 0 ? (
                              <p className="text-[11px] text-ink-muted italic py-3 text-center">
                                Nenhum pagamento de caixa realizado apropriado para este item.
                              </p>
                            ) : (
                              <div className="overflow-x-auto max-h-56">
                                <table className="w-full text-left text-[11px]">
                                  <thead>
                                    <tr className="text-ink-muted border-b border-black/5 font-bold">
                                      <th className="p-1.5">Pagamento / Favorecido</th>
                                      <th className="p-1.5 text-center">Data Pagto</th>
                                      <th className="p-1.5 text-right">Forma</th>
                                      <th className="p-1.5 text-right text-emerald-700">Valor Pago</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-black/5 font-medium">
                                    {row.realizadoMovimentos.map((m, idx) => (
                                      <tr key={m.movimentoId || idx} className="hover:bg-emerald-50/40">
                                        <td className="p-1.5">
                                          <span className="font-bold text-ink-primary block truncate max-w-[200px]">{m.pessoaNome}</span>
                                          <span className="text-[10px] text-ink-muted truncate block max-w-[200px]">
                                            Doc: {m.numeroDocumento || '-'} {m.descricao ? `• ${m.descricao}` : ''}
                                          </span>
                                        </td>
                                        <td className="p-1.5 text-center font-mono text-ink-muted">
                                          {m.dataPagamento ? m.dataPagamento.split('-').reverse().join('/') : '-'}
                                        </td>
                                        <td className="p-1.5 text-right text-[10px] uppercase font-semibold text-ink-muted">
                                          {m.formaPagamento || '-'}
                                        </td>
                                        <td className="p-1.5 text-right font-mono font-bold text-emerald-700">
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

          {/* RODAPÉ COM TOTAIS CONSOLIDADOS */}
          <tfoot>
            <tr className="bg-surface-muted border-t-2 border-black/10 font-mono font-bold text-xs">
              <td colSpan={4} className="p-3.5 text-right uppercase text-ink-muted">
                Totais Consolidados:
              </td>
              <td className="p-3.5 text-right text-brand text-sm">
                {formatCurrency(totalGeralEsperadoCentavos)}
              </td>
              <td className="p-3.5 text-right text-emerald-700 bg-emerald-50/40 text-sm">
                {formatCurrency(totalGeralPagoCentavos)}
              </td>
              <td className="p-3.5 text-right text-amber-700 bg-amber-50/40 text-sm">
                {formatCurrency(totalGeralComprometidoCentavos)}
              </td>
              <td className={`p-3.5 text-right text-sm ${
                totalGeralSaldoCentavos < 0 ? 'text-rose-600' : 'text-ink-primary'
              }`}>
                {formatCurrency(totalGeralSaldoCentavos)}
              </td>
              <td className="p-3.5 text-center min-w-[180px] font-mono font-bold text-xs text-ink-primary">
                {totalGeralEsperadoCentavos > 0
                  ? `${(((totalGeralPagoCentavos + totalGeralComprometidoCentavos) / totalGeralEsperadoCentavos) * 100).toFixed(1)}%`
                  : '0.0%'}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* MODAL DETALHADO: INSPEÇÃO DE APROPRIAÇÕES DE UM ITEM */}
      {modalApropriacaoRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm overflow-hidden">
          <div className="bg-surface rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-black/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Fixo */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 shrink-0 bg-surface">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand/10 text-brand rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-ink-primary">
                      {modalApropriacaoRow.codigo ? `${modalApropriacaoRow.codigo} - ` : ''}
                      {modalApropriacaoRow.descricao || 'Item do Orçamento'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80">
                      Unidade: {unidadesLocais.find(c => c.id === modalApropriacaoRow.centroCustoId)?.nome || 'Toda a obra'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Detalhamento dos títulos financeiros e pagamentos apropriados nesta linha
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalApropriacaoRow(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-black/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Painel de Métricas do Item */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-6 py-3 bg-surface-muted/50 border-b border-black/5 shrink-0 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-black/5">
                <span className="text-[10px] font-bold uppercase text-ink-muted block">Valor Esperado</span>
                <span className="font-mono font-bold text-brand text-sm">
                  {formatCurrency(modalApropriacaoRow.valorEsperadoCentavos)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-emerald-100">
                <span className="text-[10px] font-bold uppercase text-emerald-700 block">Total Pago</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {formatCurrency(modalApropriacaoRow.totalPagoCentavos || 0)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-amber-100">
                <span className="text-[10px] font-bold uppercase text-amber-700 block">A Pagar</span>
                <span className="font-mono font-bold text-amber-700 text-sm">
                  {formatCurrency(modalApropriacaoRow.totalComprometidoCentavos || 0)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-black/5">
                <span className="text-[10px] font-bold uppercase text-ink-muted block">Saldo Aberto</span>
                <span className={`font-mono font-bold text-sm ${
                  (modalApropriacaoRow.saldoCentavos || 0) < 0 ? 'text-rose-600' : 'text-ink-primary'
                }`}>
                  {formatCurrency(modalApropriacaoRow.saldoCentavos ?? 0)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-black/5 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase text-ink-muted block">% Consumido</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono font-bold text-xs text-ink-primary">
                    {(modalApropriacaoRow.percentualConsumido || 0).toFixed(1)}%
                  </span>
                  {getSemaforoBadge(modalApropriacaoRow.percentualConsumido || 0)}
                </div>
              </div>
            </div>

            {/* Abas e Filtros de Pesquisa */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pt-3 pb-2 shrink-0 border-b border-black/5 bg-surface">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setModalTab('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    modalTab === 'todos'
                      ? 'bg-brand text-white shadow-xs'
                      : 'bg-surface-muted text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  Todos ({((modalApropriacaoRow.comprometidoTitulos?.length || 0) + (modalApropriacaoRow.realizadoMovimentos?.length || 0))})
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('comprometido')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    modalTab === 'comprometido'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-surface-muted text-ink-muted hover:text-amber-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>A Pagar ({modalApropriacaoRow.comprometidoTitulos?.length || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('realizado')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    modalTab === 'realizado'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-surface-muted text-ink-muted hover:text-emerald-800'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Pagos ({modalApropriacaoRow.realizadoMovimentos?.length || 0})</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por favorecido, doc..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-surface-muted border border-black/10 rounded-lg text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand w-full sm:w-56"
                />
              </div>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Tabela de Comprometidos (A Pagar) */}
              {(modalTab === 'todos' || modalTab === 'comprometido') && (
                <div className="space-y-2">
                  {modalTab === 'todos' && (
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Contas a Pagar / Títulos em Aberto ({modalApropriacaoRow.comprometidoTitulos?.length || 0})
                    </h4>
                  )}

                  {(!modalApropriacaoRow.comprometidoTitulos || modalApropriacaoRow.comprometidoTitulos.length === 0) ? (
                    modalTab === 'comprometido' && (
                      <div className="p-8 text-center bg-surface-muted/40 rounded-xl border border-black/5">
                        <Clock className="w-8 h-8 text-ink-muted/40 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-ink-muted">Nenhum título a pagar em aberto apropriado nesta linha.</p>
                      </div>
                    )
                  ) : (
                    <div className="bg-white rounded-xl border border-amber-200/80 overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-amber-50/60 text-amber-900 font-bold border-b border-amber-200/60 text-[11px]">
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Favorecido / Fornecedor</th>
                            <th className="p-2.5">Documento & Descrição</th>
                            <th className="p-2.5 text-center">Competência</th>
                            <th className="p-2.5 text-center">Vencimento</th>
                            <th className="p-2.5 text-right">Valor Parcela</th>
                            <th className="p-2.5 text-right">% Rateio</th>
                            <th className="p-2.5 text-right text-amber-800">Valor Apropriado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 font-medium">
                          {modalApropriacaoRow.comprometidoTitulos
                            .filter(t => {
                              if (!modalSearch) return true;
                              const q = modalSearch.toLowerCase();
                              return (
                                t.pessoaNome?.toLowerCase().includes(q) ||
                                t.numeroDocumento?.toLowerCase().includes(q) ||
                                t.descricao?.toLowerCase().includes(q)
                              );
                            })
                            .map((t, idx) => (
                              <tr key={t.parcelaId || idx} className="hover:bg-amber-50/30 transition-colors">
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                                    A Pagar
                                  </span>
                                </td>
                                <td className="p-2.5 font-bold text-ink-primary">{t.pessoaNome}</td>
                                <td className="p-2.5">
                                  <span className="font-mono font-semibold text-ink-primary">{t.numeroDocumento || '-'}</span>
                                  {t.descricao && <span className="text-ink-muted text-[11px] block">{t.descricao}</span>}
                                </td>
                                <td className="p-2.5 text-center font-mono text-ink-muted">
                                  {t.dataCompetencia ? t.dataCompetencia.split('-').reverse().join('/') : '-'}
                                </td>
                                <td className="p-2.5 text-center font-mono text-ink-primary font-bold">
                                  {t.dataVencimento ? t.dataVencimento.split('-').reverse().join('/') : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-ink-muted">
                                  {formatCurrency(t.valorTotalParcelaCentavos)}
                                </td>
                                <td className="p-2.5 text-right font-mono font-semibold text-ink-muted">
                                  {t.percentualRateio}%
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-amber-800 text-sm">
                                  {formatCurrency(t.valorRateadoCentavos)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tabela de Realizados (Pagamentos) */}
              {(modalTab === 'todos' || modalTab === 'realizado') && (
                <div className="space-y-2">
                  {modalTab === 'todos' && (
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 pt-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Movimentos Pagos / Realizado no Caixa ({modalApropriacaoRow.realizadoMovimentos?.length || 0})
                    </h4>
                  )}

                  {(!modalApropriacaoRow.realizadoMovimentos || modalApropriacaoRow.realizadoMovimentos.length === 0) ? (
                    modalTab === 'realizado' && (
                      <div className="p-8 text-center bg-surface-muted/40 rounded-xl border border-black/5">
                        <CheckCircle2 className="w-8 h-8 text-ink-muted/40 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-ink-muted">Nenhum pagamento de caixa realizado apropriado nesta linha.</p>
                      </div>
                    )
                  ) : (
                    <div className="bg-white rounded-xl border border-emerald-200/80 overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-emerald-50/60 text-emerald-900 font-bold border-b border-emerald-200/60 text-[11px]">
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Favorecido / Fornecedor</th>
                            <th className="p-2.5">Documento & Descrição</th>
                            <th className="p-2.5 text-center">Data Pagamento</th>
                            <th className="p-2.5 text-center">Forma</th>
                            <th className="p-2.5 text-right">Valor Total Pago</th>
                            <th className="p-2.5 text-right">% Rateio</th>
                            <th className="p-2.5 text-right text-emerald-800">Valor Apropriado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 font-medium">
                          {modalApropriacaoRow.realizadoMovimentos
                            .filter(m => {
                              if (!modalSearch) return true;
                              const q = modalSearch.toLowerCase();
                              return (
                                m.pessoaNome?.toLowerCase().includes(q) ||
                                m.numeroDocumento?.toLowerCase().includes(q) ||
                                m.descricao?.toLowerCase().includes(q)
                              );
                            })
                            .map((m, idx) => (
                              <tr key={m.movimentoId || idx} className="hover:bg-emerald-50/30 transition-colors">
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                                    Pago
                                  </span>
                                </td>
                                <td className="p-2.5 font-bold text-ink-primary">{m.pessoaNome}</td>
                                <td className="p-2.5">
                                  <span className="font-mono font-semibold text-ink-primary">{m.numeroDocumento || '-'}</span>
                                  {m.descricao && <span className="text-ink-muted text-[11px] block">{m.descricao}</span>}
                                </td>
                                <td className="p-2.5 text-center font-mono text-ink-primary font-bold">
                                  {m.dataPagamento ? m.dataPagamento.split('-').reverse().join('/') : '-'}
                                </td>
                                <td className="p-2.5 text-center text-[10px] uppercase font-semibold text-ink-muted">
                                  {m.formaPagamento || '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-ink-muted">
                                  {formatCurrency(m.valorPagoMovimentoCentavos)}
                                </td>
                                <td className="p-2.5 text-right font-mono font-semibold text-ink-muted">
                                  {m.percentualRateio}%
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-emerald-800 text-sm">
                                  {formatCurrency(m.valorRateadoMovimentoCentavos)}
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

            {/* Footer Fixo */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-black/5 bg-surface-muted/60 shrink-0">
              <span className="text-xs text-ink-muted font-medium">
                Total apropriado: <strong className="text-ink-primary font-mono">{formatCurrency((modalApropriacaoRow.totalPagoCentavos || 0) + (modalApropriacaoRow.totalComprometidoCentavos || 0))}</strong> de <strong className="text-brand font-mono">{formatCurrency(modalApropriacaoRow.valorEsperadoCentavos)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setModalApropriacaoRow(null)}
                className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98] transition-all"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR NOVA UNIDADE CONSTRUTIVA RÁPIDA */}
      {modalNovaUnidadeOpen && podeCriarUnidade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl border border-black/10 space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink-primary">Nova Unidade Construtiva</h3>
                  <p className="text-xs text-ink-muted">Adicionar macro-etapa ou agrupador na obra</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNovaUnidadeOpen(false)}
                className="text-ink-muted hover:text-ink-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">
                  Nome da Unidade Construtiva *
                </label>
                <input
                  type="text"
                  placeholder="Ex: IMPOSTOS, ENGENHARIA, MÃO DE OBRA..."
                  value={nomeNovaUnidade}
                  onChange={(e) => setNomeNovaUnidade(e.target.value)}
                  className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-semibold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <span className="text-[11px] font-semibold text-ink-muted block mb-1.5">Sugestões rápidas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'IMPOSTOS',
                    'ENGENHARIA',
                    'MÃO DE OBRA',
                    'MATERIAIS',
                    'ADMINISTRAÇÃO DA OBRA',
                    'MÁQUINAS & EQUIPAMENTOS',
                    'TORRE 1',
                    'ÁREA COMUM',
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNomeNovaUnidade(s)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                        nomeNovaUnidade === s
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white hover:bg-purple-50 hover:text-purple-700 text-ink-muted border-black/10'
                      }`}
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-black/5">
              <button
                type="button"
                onClick={() => setModalNovaUnidadeOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-black/5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleCriarUnidadeRapida(nomeNovaUnidade)}
                disabled={!nomeNovaUnidade.trim() || criandoUnidade}
                className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{criandoUnidade ? 'Criando...' : 'Salvar Unidade'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
