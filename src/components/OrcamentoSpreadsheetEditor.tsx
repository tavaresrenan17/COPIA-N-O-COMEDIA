'use client';

import React, { useState, useEffect } from 'react';
import { PlanoConta, CentroCusto, erpRepository } from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { proximoCodigo } from '@/lib/codigos';
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
  PieChart
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
}

interface OrcamentoSpreadsheetEditorProps {
  dataInicio?: string;
  dataFim?: string;
  planosNivel2?: PlanoConta[];
  /** Unidades Construtivas da obra deste orçamento. */
  subCentrosCusto?: CentroCusto[];
  obraId?: string;
  obraNome?: string;
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

  useEffect(() => {
    setUnidadesLocais(subCentrosCusto);
  }, [subCentrosCusto]);

  useEffect(() => {
    async function carregarExecucaoEItens() {
      const execucaoMap = new Map<string, { realizado: number; comprometido: number; saldo: number; percentual: number }>();
      
      if (orcamentoId) {
        try {
          const exec = await erpRepository.getOrcamentoExecucao(orcamentoId);
          if (exec && exec.itensExecucao) {
            exec.itensExecucao.forEach((it, idx) => {
              const data = {
                realizado: it.realizadoCentavos,
                comprometido: it.comprometidoCentavos,
                saldo: it.saldoCentavos,
                percentual: it.percentualConsumido
              };
              if (it.itemId) execucaoMap.set(it.itemId, data);
              if (it.itemCodigo) execucaoMap.set(`code:${it.itemCodigo}`, data);
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
            percentualConsumido: pct
          };
        });
        setRows(convertedRows);
      } else {
        setRows([criarNovaLinhaVazia()]);
      }
    }

    carregarExecucaoEItens();
  }, [orcamentoId, initialItens]);

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
      percentualConsumido: 0
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
    if (!nome.trim()) return;
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
    if (pct > 100) return <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">🔴 Estourado</span>;
    if (pct >= 80) return <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">🟡 Alerta</span>;
    return <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">🟢 Normal</span>;
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
          {!isReadonly && (
            <>
              <button
                type="button"
                onClick={() => setModalNovaUnidadeOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-surface border border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl text-xs font-semibold shadow-soft transition-all"
                title="Cadastrar nova Unidade Construtiva para esta obra"
              >
                <Building2 className="w-4 h-4 text-purple-600" />
                <span>+ Nova Unidade</span>
              </button>

              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-surface border border-black/10 text-ink-primary hover:bg-black/5 rounded-xl text-xs font-semibold shadow-soft transition-all"
              >
                <Plus className="w-4 h-4 text-brand" />
                <span>Adicionar Linha</span>
              </button>
            </>
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
              <th className="p-3 w-28">Código</th>
              <th className="p-3 min-w-[200px]">Unidade Construtiva</th>
              <th className="p-3 min-w-[260px]">Item do Orçamento</th>
              <th className="p-3 w-40 text-right text-brand font-bold" title="Valor total previsto cadastrado pelo engenheiro">
                Valor Esperado (R$)
              </th>
              <th className="p-3 w-36 text-right text-emerald-700 bg-emerald-50/50">Total Pago (R$)</th>
              <th className="p-3 w-36 text-right text-amber-700 bg-amber-50/50">A Pagar (R$)</th>
              <th className="p-3 w-40 text-right text-ink-primary font-bold">Saldo em Aberto (R$)</th>
              <th className="p-3 w-32 text-center">% Consumido</th>
              {!isReadonly && <th className="p-3 w-14 text-center">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 font-medium">
            {rows.map((row, rIdx) => {
              const pago = row.totalPagoCentavos || 0;
              const comp = row.totalComprometidoCentavos || 0;
              const saldo = row.saldoCentavos ?? (row.valorEsperadoCentavos - pago - comp);
              const pct = row.percentualConsumido || 0;

              return (
                <tr 
                  key={row.id} 
                  className={`transition-colors ${
                    saldo < 0 ? 'bg-rose-50/40' : rIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-muted/20'
                  }`}
                >
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
                      <span className="text-ink-primary font-semibold">{row.descricao || '-'}</span>
                    ) : (
                      <input
                        type="text"
                        placeholder="Ex: CARRO + COMBUSTÍVEL, MÃO DE OBRA, CONCRETO..."
                        value={row.descricao}
                        onChange={(e) => handleRowFieldChange(row.id, 'descricao', e.target.value)}
                        className="w-full bg-surface border border-black/10 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-primary focus:ring-2 focus:ring-brand"
                      />
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
                    {formatCurrency(pago)}
                  </td>

                  {/* 6. A Pagar (R$) */}
                  <td className="p-2.5 text-right font-mono font-bold text-amber-700 bg-amber-50/20">
                    {formatCurrency(comp)}
                  </td>

                  {/* 7. Saldo em Aberto / Restante (R$) */}
                  <td className={`p-2.5 text-right font-mono font-bold ${
                    saldo < 0 ? 'text-rose-600' : 'text-ink-primary'
                  }`}>
                    {formatCurrency(saldo)}
                  </td>

                  {/* 8. % Consumido & Status */}
                  <td className="p-2.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center justify-between w-full text-[10px] font-bold font-mono">
                        <span>{pct.toFixed(1)}%</span>
                        {getSemaforoBadge(pct)}
                      </div>
                      <div className="w-full bg-black/5 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full ${
                            pct > 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Coluna Ações */}
                  {!isReadonly && (
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        title="Excluir Linha"
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* RODAPÉ COM TOTAIS CONSOLIDADOS */}
          <tfoot>
            <tr className="bg-surface-muted border-t-2 border-black/10 font-mono font-bold text-xs">
              <td colSpan={3} className="p-3.5 text-right uppercase text-ink-muted">
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
              <td className="p-3.5 text-center">
                {totalGeralEsperadoCentavos > 0
                  ? `${(((totalGeralPagoCentavos + totalGeralComprometidoCentavos) / totalGeralEsperadoCentavos) * 100).toFixed(1)}%`
                  : '0.0%'}
              </td>
              {!isReadonly && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* MODAL: CRIAR NOVA UNIDADE CONSTRUTIVA RÁPIDA */}
      {modalNovaUnidadeOpen && (
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
