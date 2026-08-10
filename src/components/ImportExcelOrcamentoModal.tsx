'use client';

import React, { useState } from 'react';
import { PlanoConta } from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Download, 
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';

export interface ExcelImportRowRecognized {
  linhaOriginal: number;
  codigoPlanoConta: string;
  planoContaValido: boolean;
  planoContaId?: string;
  planoContaNome?: string;
  descricao: string;
  quantidade?: number;
  unidade: string;
  valorUnitarioCentavos?: number;
  valorTotalCentavos: number;
  erro?: string;
}

interface ImportExcelOrcamentoModalProps {
  planosNivel2: PlanoConta[];
  onConfirmImport: (itensValidados: {
    planoContaId: string;
    descricao?: string;
    quantidade?: number;
    unidade?: string;
    valorUnitarioCentavos?: number;
    valorTotalCentavos: number;
  }[]) => void;
  onClose: () => void;
}

export function ImportExcelOrcamentoModal({
  planosNivel2,
  onConfirmImport,
  onClose
}: ImportExcelOrcamentoModalProps) {
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<ExcelImportRowRecognized[]>([]);
  const [hasErrors, setHasErrors] = useState(false);
  const [processed, setProcessed] = useState(false);

  function parseCSVContent(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const recognized: ExcelImportRowRecognized[] = [];
    let errFound = false;

    // Pula o cabeçalho (linha 1)
    for (let i = 1; i < lines.length; i++) {
      const colunas = lines[i].split(';').length > 1 ? lines[i].split(';') : lines[i].split(',');
      if (colunas.length < 2) continue;

      const codigoRaw = colunas[0]?.trim() || '';
      const desc = colunas[1]?.trim() || '';
      const qtdRaw = colunas[2]?.trim() || '';
      const unidRaw = colunas[3]?.trim() || 'un';
      const vlrUnitRaw = colunas[4]?.trim() || '';

      const pc = planosNivel2.find(p => p.codigo === codigoRaw || p.codigo.startsWith(codigoRaw));
      
      const qtdNum = parseFloat(qtdRaw.replace(',', '.')) || undefined;
      const vlrUnitNum = parseFloat(vlrUnitRaw.replace(',', '.')) || undefined;
      let vlrTotalCentavos = 0;

      if (qtdNum && vlrUnitNum) {
        vlrTotalCentavos = Math.round(qtdNum * vlrUnitNum * 100);
      } else if (vlrUnitNum) {
        vlrTotalCentavos = Math.round(vlrUnitNum * 100);
      }

      let erroStr: string | undefined = undefined;
      if (!pc) {
        erroStr = `Código do plano de contas "${codigoRaw}" não encontrado ou não é de Nível 2.`;
        errFound = true;
      } else if (vlrTotalCentavos <= 0) {
        erroStr = `Valor unitário ou total zerado/inválido.`;
        errFound = true;
      }

      recognized.push({
        linhaOriginal: i + 1,
        codigoPlanoConta: codigoRaw,
        planoContaValido: !!pc,
        planoContaId: pc?.id,
        planoContaNome: pc?.nome,
        descricao: desc,
        quantidade: qtdNum,
        unidade: unidRaw,
        valorUnitarioCentavos: vlrUnitNum ? Math.round(vlrUnitNum * 100) : undefined,
        valorTotalCentavos: vlrTotalCentavos,
        erro: erroStr
      });
    }

    setHasErrors(errFound);
    return recognized;
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const rows = parseCSVContent(content);
        setPreviewRows(rows);
        setProcessed(true);
      }
    };
    reader.readAsText(file);
  }

  function handleDownloadExemploCSV() {
    const csvHeader = 'PlanoContaCodigo;Descricao;Quantidade;Unidade;ValorUnitario\n';
    const csvLines = planosNivel2.slice(0, 4).map(p => `${p.codigo};Serviço/Material ${p.nome};10;m²;150,00`).join('\n');
    const blob = new Blob([csvHeader + csvLines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_orcamento.csv';
    a.click();
  }

  function handleConfirm() {
    if (hasErrors) {
      if (!confirm('Algumas linhas possuem erros de validação e não serão importadas. Deseja prosseguir apenas com as linhas válidas?')) {
        return;
      }
    }

    const validas = previewRows
      .filter(r => r.planoContaValido && !r.erro && r.planoContaId)
      .map(r => ({
        planoContaId: r.planoContaId!,
        descricao: r.descricao,
        quantidade: r.quantidade,
        unidade: r.unidade,
        valorUnitarioCentavos: r.valorUnitarioCentavos,
        valorTotalCentavos: r.valorTotalCentavos
      }));

    onConfirmImport(validas);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-surface rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-black/10 max-h-[85vh] overflow-y-auto space-y-5"
      >
        <div className="flex items-center justify-between border-b border-black/5 pb-3">
          <div>
            <h3 className="text-base font-bold text-ink-primary">Importação de Orçamento via Excel / CSV</h3>
            <p className="text-xs text-ink-muted">Valide as colunas antes de importar para o editor</p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ÁREA DE UPLOAD & MODELO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 border-2 border-dashed border-black/15 hover:border-brand rounded-2xl p-6 text-center cursor-pointer bg-surface-muted/30 transition-all relative">
            <input
              type="file"
              accept=".csv, .xlsx, .txt"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-8 h-8 text-brand" />
              <span className="text-xs font-bold text-ink-primary">
                {fileName ? fileName : 'Clique ou arraste a planilha (.csv / .xlsx)'}
              </span>
              <span className="text-[10px] text-ink-muted">Colunas: Código Plano Conta, Descrição, Qtd, Unid, Valor Unitário</span>
            </div>
          </div>

          <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-brand block">Modelo de Planilha</span>
              <p className="text-[11px] text-ink-muted">Baixe o modelo com os códigos do Plano de Contas Nível 2 cadastrados.</p>
            </div>
            <button
              onClick={handleDownloadExemploCSV}
              className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-brand-hover transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Modelo CSV</span>
            </button>
          </div>
        </div>

        {/* PREVIEW INTERATIVO DE LINHAS RECONHECIDAS */}
        {processed && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                Preview do Arquivo ({previewRows.length} linhas reconhecidas)
              </span>
              {hasErrors ? (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Erros Encontrados
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Todas as Linhas Válidas
                </span>
              )}
            </div>

            <div className="border border-black/10 rounded-xl overflow-hidden max-h-60 overflow-y-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted text-[11px] font-bold text-ink-muted uppercase border-b border-black/10">
                    <th className="p-2 w-12 text-center">Linha</th>
                    <th className="p-2">Código</th>
                    <th className="p-2">Plano de Contas</th>
                    <th className="p-2">Descrição</th>
                    <th className="p-2 text-right">Valor Total</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 font-medium">
                  {previewRows.map(r => (
                    <tr key={r.linhaOriginal} className={r.erro ? 'bg-rose-50/70' : 'hover:bg-black/5'}>
                      <td className="p-2 text-center font-mono text-ink-muted">{r.linhaOriginal}</td>
                      <td className="p-2 font-mono font-bold">{r.codigoPlanoConta}</td>
                      <td className="p-2">
                        {r.planoContaValido ? (
                          <span className="font-bold text-ink-primary">{r.planoContaNome}</span>
                        ) : (
                          <span className="text-rose-600 font-bold">Código Inexistente</span>
                        )}
                      </td>
                      <td className="p-2 text-ink-muted truncate max-w-[150px]">{r.descricao || '-'}</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {r.valorTotalCentavos > 0 ? formatCurrency(r.valorTotalCentavos) : '-'}
                      </td>
                      <td className="p-2 text-center">
                        {r.erro ? (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full" title={r.erro}>
                            Erro
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-black/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!processed || previewRows.length === 0}
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md disabled:bg-gray-300"
          >
            <span>Confirmar Importação</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
