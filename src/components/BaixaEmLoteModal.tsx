'use client';

import React, { useEffect, useState } from 'react';
import { erpRepository, ParcelaView, ContaBancaria, FormaPagamentoMovimento, TipoTitulo } from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { X, Layers, Paperclip, UploadCloud, FileText, Image as ImageIcon, Trash2, ExternalLink, DollarSign, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from './ui/ToastProvider';

interface BaixaEmLoteModalProps {
  tipo: TipoTitulo;
  parcelasSelecionadas: ParcelaView[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export interface ComprovanteAnexo {
  id: string;
  nome: string;
  tamanhoFormatted: string;
  dataUpload: string;
  url?: string;
}

export function BaixaEmLoteModal({ tipo, parcelasSelecionadas, isOpen, onClose, onSuccess }: BaixaEmLoteModalProps) {
  const toast = useToast();
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);

  const [abaModal, setAbaModal] = useState<'dados' | 'comprovantes'>('dados');
  const [comprovantes, setComprovantes] = useState<ComprovanteAnexo[]>([]);

  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [contaBancariaId, setContaBancariaId] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoMovimento>('pix');

  useEffect(() => {
    if (isOpen) {
      loadContas();
      setComprovantes([]);
      setAbaModal('dados');
    }
  }, [isOpen]);

  async function loadContas() {
    setLoading(true);
    const list = await erpRepository.getContasBancarias({ apenasAtivos: true });
    setContasBancarias(list);
    if (list.length > 0) setContaBancariaId(list[0].id);
    setLoading(false);
  }

  const totalEmLoteCentavos = parcelasSelecionadas.reduce((sum, p) => sum + p.saldoCentavos, 0);

  const handleUploadFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const novos: ComprovanteAnexo[] = Array.from(files).map((file) => {
      const sizeKB = (file.size / 1024).toFixed(1);
      return {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        nome: file.name,
        tamanhoFormatted: `${sizeKB} KB`,
        dataUpload: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        url: URL.createObjectURL(file),
      };
    });

    setComprovantes(prev => [...prev, ...novos]);
    toast.success(`${novos.length} comprovante(s) anexado(s) à baixa em lote`);
  };

  const handleRemoveComprovante = (id: string) => {
    setComprovantes(prev => prev.filter(c => c.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parcelasSelecionadas.length === 0) return;

    await erpRepository.createBaixaEmLote({
      parcelaIds: parcelasSelecionadas.map(p => p.parcelaId),
      dataPagamento,
      contaBancariaId,
      formaPagamento
    });

    const isRec = tipo === 'R';
    toast.success(isRec ? 'Baixa em lote de recebimento realizada' : 'Baixa em lote de pagamento realizada', {
      description: `${parcelasSelecionadas.length} parcelas — ${formatCurrency(totalEmLoteCentavos)}${
        comprovantes.length > 0 ? ` (${comprovantes.length} comprovantes)` : ''
      }`,
    });

    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  const isRecebimento = tipo === 'R';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-black/10 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-light text-brand">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-primary">
                {isRecebimento ? 'Baixa em Lote (Contas a Receber)' : 'Baixa em Lote (Contas a Pagar)'}
              </h3>
              <span className="text-xs text-ink-muted">{parcelasSelecionadas.length} parcelas selecionadas</span>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo em Destaque */}
        <div className="p-4 bg-surface-muted rounded-xl border border-black/5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-ink-muted uppercase tracking-wider block">Total Selecionado</span>
            <span className="text-2xl font-bold text-brand tracking-tight mt-0.5 block">
              {formatCurrency(totalEmLoteCentavos)}
            </span>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-brand/10 text-brand rounded-full">
            {parcelasSelecionadas.length} itens
          </span>
        </div>

        {/* Abas: Dados VS Comprovantes */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setAbaModal('dados')}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              abaModal === 'dados'
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Parâmetros da Baixa
          </button>
          <button
            type="button"
            onClick={() => setAbaModal('comprovantes')}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              abaModal === 'comprovantes'
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            Comprovantes {isRecebimento ? 'de Recebimento' : 'de Pagamento'}
            {comprovantes.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-brand text-white text-[10px] font-bold">
                {comprovantes.length}
              </span>
            )}
          </button>
        </div>

        {/* Form */}
        {loading ? (
          <div className="p-6 text-center text-ink-muted">Carregando contas...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {abaModal === 'dados' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Data do {isRecebimento ? 'Recebimento' : 'Pagamento'} *
                  </label>
                  <input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Conta Bancária / Caixa *</label>
                    <select
                      value={contaBancariaId}
                      onChange={(e) => setContaBancariaId(e.target.value)}
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      {contasBancarias.map(cb => (
                        <option key={cb.id} value={cb.id}>
                          {cb.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Forma de Pagamento *</label>
                    <select
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value as FormaPagamentoMovimento)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto Bancário</option>
                      <option value="ted">TED / Transferência</option>
                      <option value="dinheiro">Dinheiro em Espécie</option>
                      <option value="cartao">Cartão</option>
                      <option value="cheque">Cheque</option>
                      <option value="permuta">Permuta</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {abaModal === 'comprovantes' && (
              <div className="space-y-4">
                <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50 rounded-2xl p-5 text-center cursor-pointer transition-all block">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
                    onChange={handleUploadFiles}
                    className="hidden"
                  />
                  <UploadCloud className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-800 block">
                    Clique ou arraste os comprovantes em lote aqui
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Anexe os recibos bancários de todos os itens do lote (PDF/Imagens)
                  </span>
                </label>

                {comprovantes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200/60">
                    Nenhum comprovante anexado à baixa em lote.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    <span className="text-xs font-bold text-slate-700 block mb-1">
                      Comprovantes do lote ({comprovantes.length}):
                    </span>
                    {comprovantes.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            {item.nome.toLowerCase().endsWith('.pdf') ? (
                              <FileText className="w-4 h-4" />
                            ) : (
                              <ImageIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-800 truncate block">
                              {item.nome}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span>{item.tamanhoFormatted}</span>
                              <span>•</span>
                              <span>{item.dataUpload}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              title="Visualizar comprovante"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveComprovante(item.id)}
                            title="Remover comprovante"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-black/5 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:text-ink-primary hover:bg-black/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Baixa em Lote {comprovantes.length > 0 ? `(${comprovantes.length} anexos)` : ''}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
