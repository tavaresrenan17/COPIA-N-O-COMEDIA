'use client';

import React, { useState, useEffect } from 'react';
import { PlanoConta, CentroCusto } from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  TrendingUp, 
  Lock, 
  Save, 
  X,
  HelpCircle
} from 'lucide-react';

export interface GridRowPeriodo {
  mesReferencia: string; // "2026-01-01"
  rotuloMes: string; // "01/26"
  valorReais: string; // editável no input
  valorCentavos: number;
}

export interface GridRowItem {
  id: string;
  planoContaId: string;
  centroCustoId?: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  valorUnitarioReais: string;
  valorTotalReais: string;
  valorTotalCentavos: number;
  periodos: GridRowPeriodo[];
  isValid: boolean; // soma(periodos) === valorTotalCentavos
  somaPeriodosCentavos: number;
}

interface OrcamentoSpreadsheetEditorProps {
  dataInicio: string; // "2026-01-01"
  dataFim: string; // "2026-12-31"
  planosNivel2: PlanoConta[];
  subCentrosCusto?: CentroCusto[];
  initialItens?: any[];
  isReadonly?: boolean;
  onSave: (itens: {
    planoContaId: string;
    centroCustoId?: string;
    descricao?: string;
    quantidade?: number;
    unidade?: string;
    valorUnitarioCentavos?: number;
    valorTotalCentavos: number;
    periodos: { mesReferencia: string; valorCentavos: number }[];
  }[]) => Promise<void>;
  onCancel?: () => void;
}

// Auxiliar para gerar lista de meses entre dataInicio e dataFim
function gerarListaMeses(dataInicio: string, dataFim: string) {
  const meses: { mesReferencia: string; rotuloMes: string }[] = [];
  if (!dataInicio || !dataFim) return meses;

  let cur = new Date(dataInicio);
  // Normalizar para o dia 1 do mês
  cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const end = new Date(dataFim);

  while (cur <= end) {
    const yyyy = cur.getFullYear();
    const mmNum = cur.getMonth() + 1;
    const mm = mmNum < 10 ? `0${mmNum}` : `${mmNum}`;
    const mesReferencia = `${yyyy}-${mm}-01`;
    const rotuloMes = `${mm}/${yyyy.toString().substring(2)}`;

    meses.push({ mesReferencia, rotuloMes });
    cur.setMonth(cur.getMonth() + 1);
  }

  return meses;
}

// Distribuição Curva S (Pesos percentuais em formato Sigmoide)
function calcularPesosCurvaS(qtdMeses: number): number[] {
  if (qtdMeses <= 0) return [];
  if (qtdMeses === 1) return [1.0];

  const pesos: number[] = [];
  let soma = 0;

  for (let i = 0; i < qtdMeses; i++) {
    // Normalizar t de -3 a +3 (Curva Logística Sigmoide)
    const t = -3 + (6 * i) / (qtdMeses - 1);
    // Derivada da logística (Função Densidade em Forma de S)
    const val = Math.exp(-t) / Math.pow(1 + Math.exp(-t), 2);
    pesos.push(val);
    soma += val;
  }

  // Normaliza para a soma ser exatamente 1.0
  return pesos.map(p => p / soma);
}

export function OrcamentoSpreadsheetEditor({
  dataInicio,
  dataFim,
  planosNivel2,
  subCentrosCusto = [],
  initialItens = [],
  isReadonly = false,
  onSave,
  onCancel
}: OrcamentoSpreadsheetEditorProps) {
  const listaMeses = gerarListaMeses(dataInicio, dataFim);
  const [rows, setRows] = useState<GridRowItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialItens && initialItens.length > 0) {
      const convertedRows: GridRowItem[] = initialItens.map((it, idx) => {
        const qNum = it.quantidade || 0;
        const vuNum = it.valorUnitarioCentavos ? it.valorUnitarioCentavos / 100 : 0;
        const vtCentavos = it.valorTotalCentavos || 0;

        const periodos: GridRowPeriodo[] = listaMeses.map(m => {
          let vCent = 0;
          if (it.periodos) {
            const foundP = it.periodos.find((p: any) => p.mesReferencia.substring(0, 7) === m.mesReferencia.substring(0, 7));
            if (foundP) vCent = foundP.valorCentavos;
          } else if (it.distribuicaoMensal) {
            const key = m.mesReferencia.substring(0, 7);
            if (it.distribuicaoMensal[key]) vCent = it.distribuicaoMensal[key];
          }

          return {
            mesReferencia: m.mesReferencia,
            rotuloMes: m.rotuloMes,
            valorReais: vCent > 0 ? (vCent / 100).toFixed(2).replace('.', ',') : '',
            valorCentavos: vCent
          };
        });

        const somaP = periodos.reduce((s, p) => s + p.valorCentavos, 0);

        return {
          id: it.id || `row-${Date.now()}-${idx}`,
          planoContaId: it.planoContaId || it.planoContaNivel2Id || (planosNivel2[0]?.id || ''),
          centroCustoId: it.centroCustoId,
          descricao: it.descricao || '',
          quantidade: qNum > 0 ? String(qNum) : '',
          unidade: it.unidade || 'un',
          valorUnitarioReais: vuNum > 0 ? vuNum.toFixed(2).replace('.', ',') : '',
          valorTotalReais: (vtCentavos / 100).toFixed(2).replace('.', ','),
          valorTotalCentavos: vtCentavos,
          periodos,
          somaPeriodosCentavos: somaP,
          isValid: Math.abs(somaP - vtCentavos) <= 1 // tolera 1 centavo de arredondamento
        };
      });
      setRows(convertedRows);
    } else {
      // Cria 1 linha padrão de início
      setRows([criarNovaLinhaVazia()]);
    }
  }, [dataInicio, dataFim, initialItens]);

  function criarNovaLinhaVazia(): GridRowItem {
    const pcDef = planosNivel2[0]?.id || '';
    const periodos: GridRowPeriodo[] = listaMeses.map(m => ({
      mesReferencia: m.mesReferencia,
      rotuloMes: m.rotuloMes,
      valorReais: '',
      valorCentavos: 0
    }));

    return {
      id: `row-${Date.now()}-${Math.random()}`,
      planoContaId: pcDef,
      descricao: '',
      quantidade: '',
      unidade: 'un',
      valorUnitarioReais: '',
      valorTotalReais: '0,00',
      valorTotalCentavos: 0,
      periodos,
      somaPeriodosCentavos: 0,
      isValid: true
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

  // Atualização dos campos principais da linha
  function handleRowFieldChange(rowId: string, field: keyof GridRowItem, value: any) {
    if (isReadonly) return;

    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      const updated = { ...row, [field]: value };

      // Se alterou Qtd ou Vlr Unitario, calcula Vlr Total automaticamente
      if (field === 'quantidade' || field === 'valorUnitarioReais') {
        const qNum = parseFloat(String(updated.quantidade).replace(',', '.')) || 0;
        const vuNum = parseFloat(String(updated.valorUnitarioReais).replace(',', '.')) || 0;

        if (qNum > 0 && vuNum > 0) {
          const totalCalculado = qNum * vuNum;
          updated.valorTotalReais = totalCalculado.toFixed(2).replace('.', ',');
          updated.valorTotalCentavos = Math.round(totalCalculado * 100);
        }
      } else if (field === 'valorTotalReais') {
        const vtNum = parseFloat(String(updated.valorTotalReais).replace(',', '.')) || 0;
        updated.valorTotalCentavos = Math.round(vtNum * 100);
      }

      // Revalida a soma dos períodos em relação ao valor total
      const somaP = updated.periodos.reduce((sum, p) => sum + p.valorCentavos, 0);
      updated.somaPeriodosCentavos = somaP;
      updated.isValid = Math.abs(somaP - updated.valorTotalCentavos) <= 1;

      return updated;
    }));
  }

  // Atualização do valor de um mês específico
  function handleMesChange(rowId: string, mesIndex: number, rawVal: string) {
    if (isReadonly) return;

    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      const numVal = parseFloat(rawVal.replace(',', '.')) || 0;
      const centavos = Math.round(numVal * 100);

      const newPeriodos = [...row.periodos];
      newPeriodos[mesIndex] = {
        ...newPeriodos[mesIndex],
        valorReais: rawVal,
        valorCentavos: centavos
      };

      const somaP = newPeriodos.reduce((sum, p) => sum + p.valorCentavos, 0);
      const isValid = Math.abs(somaP - row.valorTotalCentavos) <= 1;

      return {
        ...row,
        periodos: newPeriodos,
        somaPeriodosCentavos: somaP,
        isValid
      };
    }));
  }

  // DISTRIBUIÇÃO LINEAR (Divisão igual em N meses)
  function handleDistribuirLinear(rowId: string) {
    if (isReadonly) return;

    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      if (row.valorTotalCentavos <= 0 || row.periodos.length === 0) return row;

      const n = row.periodos.length;
      const valorBaseCentavos = Math.floor(row.valorTotalCentavos / n);
      let restoCentavos = row.valorTotalCentavos - (valorBaseCentavos * n);

      const newPeriodos = row.periodos.map((p, idx) => {
        // Adiciona 1 centavo aos últimos meses se houver resto de arredondamento
        const vCent = valorBaseCentavos + (idx >= n - restoCentavos ? 1 : 0);
        return {
          ...p,
          valorCentavos: vCent,
          valorReais: (vCent / 100).toFixed(2).replace('.', ',')
        };
      });

      const somaP = newPeriodos.reduce((s, p) => s + p.valorCentavos, 0);

      return {
        ...row,
        periodos: newPeriodos,
        somaPeriodosCentavos: somaP,
        isValid: true
      };
    }));
  }

  // DISTRIBUIÇÃO POR CURVA S (Sigmoide)
  function handleDistribuirCurvaS(rowId: string) {
    if (isReadonly) return;

    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      if (row.valorTotalCentavos <= 0 || row.periodos.length === 0) return row;

      const pesos = calcularPesosCurvaS(row.periodos.length);
      let somaDistribuida = 0;

      const newPeriodos = row.periodos.map((p, idx) => {
        let vCent = 0;
        if (idx === row.periodos.length - 1) {
          // Ajuste fino no último mês para fechar 100%
          vCent = row.valorTotalCentavos - somaDistribuida;
        } else {
          vCent = Math.round(row.valorTotalCentavos * pesos[idx]);
          somaDistribuida += vCent;
        }

        return {
          ...p,
          valorCentavos: Math.max(0, vCent),
          valorReais: (Math.max(0, vCent) / 100).toFixed(2).replace('.', ',')
        };
      });

      const somaP = newPeriodos.reduce((s, p) => s + p.valorCentavos, 0);

      return {
        ...row,
        periodos: newPeriodos,
        somaPeriodosCentavos: somaP,
        isValid: true
      };
    }));
  }

  // Validação Geral de todas as linhas
  const temLinhaInvalida = rows.some(r => !r.isValid);
  const totalGeralOrcadoCentavos = rows.reduce((s, r) => s + r.valorTotalCentavos, 0);

  // Somatório por coluna mensal
  const totaisMensaisCentavos = listaMeses.map((_, mIdx) => {
    return rows.reduce((sum, r) => sum + (r.periodos[mIdx]?.valorCentavos || 0), 0);
  });

  async function handleSalvarSubmit() {
    if (isReadonly) return;
    if (temLinhaInvalida) {
      alert('Existem linhas em vermelho com a soma dos meses divergente do valor total. Ajuste a distribuição mensal antes de salvar.');
      return;
    }

    setSaving(true);
    try {
      const payload = rows.map(r => ({
        planoContaId: r.planoContaId,
        centroCustoId: r.centroCustoId || undefined,
        descricao: r.descricao,
        quantidade: parseFloat(r.quantidade.replace(',', '.')) || undefined,
        unidade: r.unidade || undefined,
        valorUnitarioCentavos: Math.round((parseFloat(r.valorUnitarioReais.replace(',', '.')) || 0) * 100) || undefined,
        valorTotalCentavos: r.valorTotalCentavos,
        periodos: r.periodos.map(p => ({
          mesReferencia: p.mesReferencia,
          valorCentavos: p.valorCentavos
        }))
      }));

      await onSave(payload);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar orçamento.');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* BARRA DE AÇÕES DO EDITOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-muted p-4 rounded-2xl border border-black/5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-primary flex items-center gap-1.5">
            Editor Grid em Planilha
            {isReadonly && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border border-amber-200">
                <Lock className="w-3 h-3" />
                Modo Leitura (Aprovado)
              </span>
            )}
          </span>
          <span className="text-xs text-ink-muted">
            • <strong>{rows.length}</strong> itens • Total Geral: <strong className="text-brand font-mono">{formatCurrency(totalGeralOrcadoCentavos)}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isReadonly && (
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-black/10 text-ink-primary hover:bg-black/5 rounded-xl text-xs font-semibold shadow-soft transition-all"
            >
              <Plus className="w-4 h-4 text-brand" />
              <span>Adicionar Linha</span>
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 bg-surface border border-black/10 text-ink-muted hover:text-ink-primary rounded-xl text-xs font-semibold"
            >
              Cancelar
            </button>
          )}

          {!isReadonly && (
            <button
              type="button"
              onClick={handleSalvarSubmit}
              disabled={saving || temLinhaInvalida}
              className={`flex items-center gap-1.5 px-5 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all ${
                temLinhaInvalida 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-brand hover:bg-brand-hover text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Orçamento'}</span>
            </button>
          )}
        </div>
      </div>

      {/* AVISO DE ERRO EM VERMELHO SE HOUVER LINHA DIVERGENTE */}
      {temLinhaInvalida && !isReadonly && (
        <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Existem linhas com divergência entre o Valor Total e a soma da distribuição mensal. Ajuste as células ou use o botão de distribuição automática.</span>
          </div>
        </div>
      )}

      {/* GRID INTERATIVO TIPO PLANILHA */}
      <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.06] overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-muted border-b border-black/10 text-[11px] font-bold text-ink-muted uppercase sticky top-0 z-10">
              <th className="p-2.5 min-w-[200px]">Plano de Contas (Nível 2)</th>
              <th className="p-2.5 min-w-[160px]">Descrição do Item</th>
              <th className="p-2.5 w-20 text-right">Qtd</th>
              <th className="p-2.5 w-16 text-center">Unid</th>
              <th className="p-2.5 w-24 text-right">Vlr Unit (R$)</th>
              <th className="p-2.5 w-28 text-right">Vlr Total (R$)</th>
              <th className="p-2.5 w-28 text-center bg-black/5">Distribuição</th>
              {/* COLUNAS MENSAIS DINÂMICAS */}
              {listaMeses.map(m => (
                <th key={m.mesReferencia} className="p-2.5 w-28 text-right bg-brand/5 border-l border-black/5">
                  {m.rotuloMes}
                </th>
              ))}
              {!isReadonly && <th className="p-2.5 w-12 text-center">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 font-medium">
            {rows.map((row, rIdx) => (
              <tr 
                key={row.id} 
                className={`transition-colors ${
                  !row.isValid ? 'bg-rose-50/50' : rIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-muted/30'
                }`}
              >
                {/* 1. Plano de Contas Nível 2 */}
                <td className="p-2">
                  {isReadonly ? (
                    <span className="font-bold text-ink-primary font-mono">
                      {planosNivel2.find(p => p.id === row.planoContaId)?.codigo} - {planosNivel2.find(p => p.id === row.planoContaId)?.nome}
                    </span>
                  ) : (
                    <select
                      value={row.planoContaId}
                      onChange={(e) => handleRowFieldChange(row.id, 'planoContaId', e.target.value)}
                      className="w-full bg-surface border border-black/10 rounded-lg px-2 py-1 text-xs font-bold text-ink-primary focus:ring-2 focus:ring-brand"
                    >
                      {planosNivel2.map(pc => (
                        <option key={pc.id} value={pc.id}>{pc.codigo} - {pc.nome}</option>
                      ))}
                    </select>
                  )}
                </td>

                {/* 2. Descrição */}
                <td className="p-2">
                  {isReadonly ? (
                    <span className="text-ink-primary">{row.descricao || '-'}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ex: Escavação / Concreto..."
                      value={row.descricao}
                      onChange={(e) => handleRowFieldChange(row.id, 'descricao', e.target.value)}
                      className="w-full bg-surface border border-black/10 rounded-lg px-2 py-1 text-xs text-ink-primary focus:ring-2 focus:ring-brand"
                    />
                  )}
                </td>

                {/* 3. Quantidade */}
                <td className="p-2 text-right">
                  {isReadonly ? (
                    <span>{row.quantidade || '-'}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="0"
                      value={row.quantidade}
                      onChange={(e) => handleRowFieldChange(row.id, 'quantidade', e.target.value)}
                      className="w-full text-right bg-surface border border-black/10 rounded-lg px-2 py-1 text-xs text-ink-primary focus:ring-2 focus:ring-brand"
                    />
                  )}
                </td>

                {/* 4. Unidade */}
                <td className="p-2 text-center">
                  {isReadonly ? (
                    <span>{row.unidade}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="m²"
                      value={row.unidade}
                      onChange={(e) => handleRowFieldChange(row.id, 'unidade', e.target.value)}
                      className="w-full text-center bg-surface border border-black/10 rounded-lg px-1.5 py-1 text-xs text-ink-primary focus:ring-2 focus:ring-brand"
                    />
                  )}
                </td>

                {/* 5. Valor Unitário */}
                <td className="p-2 text-right font-mono">
                  {isReadonly ? (
                    <span>{row.valorUnitarioReais ? `R$ ${row.valorUnitarioReais}` : '-'}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="0,00"
                      value={row.valorUnitarioReais}
                      onChange={(e) => handleRowFieldChange(row.id, 'valorUnitarioReais', e.target.value)}
                      className="w-full text-right bg-surface border border-black/10 rounded-lg px-2 py-1 text-xs font-mono text-ink-primary focus:ring-2 focus:ring-brand"
                    />
                  )}
                </td>

                {/* 6. Valor Total (Calculado / Digitado) */}
                <td className="p-2 text-right font-mono font-bold">
                  {isReadonly ? (
                    <span className="text-brand">{formatCurrency(row.valorTotalCentavos)}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="0,00"
                      value={row.valorTotalReais}
                      onChange={(e) => handleRowFieldChange(row.id, 'valorTotalReais', e.target.value)}
                      className="w-full text-right bg-surface border border-black/10 rounded-lg px-2 py-1 text-xs font-bold font-mono text-brand focus:ring-2 focus:ring-brand"
                    />
                  )}
                </td>

                {/* 7. Botões Inteligentes de Distribuição por Linha */}
                <td className="p-2 text-center bg-black/5">
                  {!isReadonly && (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDistribuirLinear(row.id)}
                        title="Distribuir Linearmente (Divisão Igual)"
                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDistribuirCurvaS(row.id)}
                        title="Distribuir por Curva S (Sigmoide Obra)"
                        className="p-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg transition-all"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>

                {/* 8. COLUNAS MENSAIS EDITÁVEIS CÉLULA A CÉLULA */}
                {row.periodos.map((p, mIdx) => (
                  <td key={p.mesReferencia} className="p-2 text-right border-l border-black/5 font-mono">
                    {isReadonly ? (
                      <span className={p.valorCentavos > 0 ? 'text-ink-primary font-bold' : 'text-ink-muted/40'}>
                        {p.valorCentavos > 0 ? formatCurrency(p.valorCentavos) : '-'}
                      </span>
                    ) : (
                      <input
                        type="text"
                        placeholder="0,00"
                        value={p.valorReais}
                        onChange={(e) => handleMesChange(row.id, mIdx, e.target.value)}
                        className={`w-full text-right border rounded-lg px-2 py-1 text-xs font-mono transition-all ${
                          p.valorCentavos > 0 
                            ? 'bg-surface font-bold text-ink-primary border-black/10' 
                            : 'bg-surface-muted/50 text-ink-muted border-black/5'
                        }`}
                      />
                    )}
                  </td>
                ))}

                {/* Coluna Ações (Excluir linha) */}
                {!isReadonly && (
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      title="Excluir Linha"
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>

          {/* RODAPÉ COM TOTAIS CONSOLIDADOS */}
          <tfoot>
            <tr className="bg-surface-muted border-t-2 border-black/10 font-mono font-bold text-xs">
              <td colSpan={5} className="p-3 text-right uppercase text-ink-muted">
                Totais Consolidados:
              </td>
              <td className="p-3 text-right text-brand text-sm">
                {formatCurrency(totalGeralOrcadoCentavos)}
              </td>
              <td className="p-3 bg-black/5"></td>
              {totaisMensaisCentavos.map((valCentavos, idx) => (
                <td key={idx} className="p-3 text-right text-ink-primary border-l border-black/5">
                  {formatCurrency(valCentavos)}
                </td>
              ))}
              {!isReadonly && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
