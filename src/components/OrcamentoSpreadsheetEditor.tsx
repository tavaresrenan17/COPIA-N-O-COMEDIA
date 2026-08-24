'use client';

import React, { useState, useEffect } from 'react';
import { PlanoConta, CentroCusto, erpRepository } from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { proximoCodigo } from '@/lib/codigos';
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
  HelpCircle,
  Building2,
  Sparkles,
  Check
} from 'lucide-react';

export interface GridRowPeriodo {
  mesReferencia: string; // "2026-01-01"
  rotuloMes: string; // "01/26"
  valorReais: string; // editável no input
  valorCentavos: number;
}

export interface GridRowItem {
  id: string;
  /** Código do item na planilha ("1.1.3"). É por ele que a Apropriação o exibe. */
  codigo: string;
  planoContaId: string;
  /** Unidade Construtiva do item; vazio = item vale para a obra inteira. */
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
  /** Unidades Construtivas da obra deste orçamento (filhas dela na árvore). */
  subCentrosCusto?: CentroCusto[];
  obraId?: string;
  obraNome?: string;
  initialItens?: any[];
  isReadonly?: boolean;
  onNovaUnidade?: (nova: CentroCusto) => void;
  onSave: (itens: {
    /** Id do item já gravado; ausente/não-UUID = linha nova. */
    id?: string;
    codigo?: string;
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

  /*
   * O sufixo T00:00:00 é obrigatório: new Date("2026-01-01") é lido como UTC e,
   * em fuso negativo (BRT = UTC-3), volta para 31/12/2025 no horário local — a
   * planilha de um orçamento de janeiro nascia com uma coluna 12/25 a mais e
   * gravava o período no mês errado. Com o sufixo, a data é lida como local.
   */
  let cur = new Date(dataInicio + "T00:00:00");
  // Normalizar para o dia 1 do mês
  cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const end = new Date(dataFim + "T00:00:00");

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
  obraId,
  obraNome,
  initialItens = [],
  isReadonly = false,
  onNovaUnidade,
  onSave,
  onCancel
}: OrcamentoSpreadsheetEditorProps) {
  const listaMeses = gerarListaMeses(dataInicio, dataFim);
  const [rows, setRows] = useState<GridRowItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [unidadesLocais, setUnidadesLocais] = useState<CentroCusto[]>(subCentrosCusto);
  const [modalNovaUnidadeOpen, setModalNovaUnidadeOpen] = useState(false);
  const [nomeNovaUnidade, setNomeNovaUnidade] = useState('');
  const [criandoUnidade, setCriandoUnidade] = useState(false);

  useEffect(() => {
    setUnidadesLocais(subCentrosCusto);
  }, [subCentrosCusto]);

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
          codigo: it.codigo || '',
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
      codigo: '',
      planoContaId: pcDef,
      // Sem unidade por padrão: o item vale para a obra inteira até que o
      // usuário o prenda a uma unidade construtiva.
      centroCustoId: undefined,
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
        /*
         * Devolver o id é o que faz o repositório ATUALIZAR o item em vez de
         * apagar e recriar. Sem ele, cada salvamento geraria um id novo e a
         * apropriação de títulos que aponta para o item ficaria órfã.
         */
        id: r.id,
        codigo: r.codigo.trim() || undefined,
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
            <>
              <button
                type="button"
                onClick={() => setModalNovaUnidadeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl text-xs font-semibold shadow-soft transition-all"
                title="Cadastrar nova Unidade Construtiva para esta obra"
              >
                <Building2 className="w-4 h-4 text-purple-600" />
                <span>+ Nova Unidade</span>
              </button>

              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-black/10 text-ink-primary hover:bg-black/5 rounded-xl text-xs font-semibold shadow-soft transition-all"
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
            <span>Existem linhas com divergência entre o Valor Esperado e a soma da distribuição mensal. Ajuste as células ou use o botão de distribuição automática.</span>
          </div>
        </div>
      )}

      {/* GRID INTERATIVO TIPO PLANILHA */}
      <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.06] overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-muted border-b border-black/10 text-[11px] font-bold text-ink-muted uppercase sticky top-0 z-10">
              <th className="p-2.5 w-24">Código</th>
              <th className="p-2.5 min-w-[170px]">Unidade Construtiva</th>
              <th className="p-2.5 min-w-[200px]">Plano Financeiro (Nível 2)</th>
              <th className="p-2.5 min-w-[170px]">Item do Orçamento</th>
              <th className="p-2.5 w-20 text-right">Qtd</th>
              <th className="p-2.5 w-16 text-center">Unid</th>
              <th className="p-2.5 w-24 text-right">Vlr Unit (R$)</th>
              <th className="p-2.5 w-32 text-right text-brand" title="Valor total previsto orçado pelo engenheiro responsável">
                Valor Esperado (R$)
              </th>
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
                {/* 1. Código do item */}
                <td className="p-2">
                  {isReadonly ? (
                    <span className="font-mono font-bold text-ink-primary">{row.codigo || '-'}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="1.1.3"
                      value={row.codigo}
                      onChange={(e) => handleRowFieldChange(row.id, 'codigo', e.target.value)}
                      className="w-full bg-surface border border-black/10 rounded-lg px-2 py-1 text-xs font-mono font-bold text-ink-primary focus:ring-2 focus:ring-brand"
                    />
                  )}
                </td>

                {/* 2. Unidade Construtiva */}
                <td className="p-2">
                  {isReadonly ? (
                    <span className="text-ink-primary font-semibold">
                      {unidadesLocais.find(c => c.id === row.centroCustoId)?.nome || 'Toda a obra'}
                    </span>
                  ) : (
                    <select
                      value={row.centroCustoId || ''}
                      onChange={(e) => handleRowFieldChange(row.id, 'centroCustoId', e.target.value)}
                      className="w-full bg-surface border border-black/10 rounded-lg px-2 py-1 text-xs font-semibold text-ink-primary focus:ring-2 focus:ring-brand"
                    >
                      <option value="">Toda a obra</option>
                      {unidadesLocais.map(c => (
                        <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>
                      ))}
                    </select>
                  )}
                </td>

                {/* 3. Plano de Contas Nível 2 */}
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

                {/* 4. Item do Orçamento (Descrição) */}
                <td className="p-2">
                  {isReadonly ? (
                    <span className="text-ink-primary">{row.descricao || '-'}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ex: Folha Mão de Obra, Concreto, ISS..."
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
              {/* 7 = Código, Unidade Construtiva, Plano Financeiro, Descrição, Qtd,
                  Unid, Vlr Unit. Ficou em 5 quando as duas primeiras colunas
                  foram acrescentadas, e todos os totais saíam duas colunas à
                  esquerda do seu cabeçalho. */}
              <td colSpan={7} className="p-3 text-right uppercase text-ink-muted">
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
