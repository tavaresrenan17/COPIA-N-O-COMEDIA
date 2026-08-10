'use client';

import React, { useEffect, useState } from 'react';
import { erpRepository, ParcelaView, ContaBancaria, FormaPagamentoMovimento } from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { CheckCircle2, DollarSign, AlertCircle, Paperclip, UploadCloud, FileText, Image as ImageIcon, Trash2, ExternalLink } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useToast } from './ui/ToastProvider';

interface BaixaParcelaModalProps {
  parcela: ParcelaView | null;
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
  tipo: string;
}

export function BaixaParcelaModal({ parcela, isOpen, onClose, onSuccess }: BaixaParcelaModalProps) {
  const toast = useToast();
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Tab State: 'dados' ou 'comprovantes'
  const [abaModal, setAbaModal] = useState<'dados' | 'comprovantes'>('dados');
  const [comprovantes, setComprovantes] = useState<ComprovanteAnexo[]>([]);

  // Form State
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [valorPagoReais, setValorPagoReais] = useState('');
  const [jurosReais, setJurosReais] = useState('0,00');
  const [multaReais, setMultaReais] = useState('0,00');
  const [descontoReais, setDescontoReais] = useState('0,00');
  const [contaBancariaId, setContaBancariaId] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoMovimento>('pix');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [observacao, setObservacao] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && parcela) {
      loadContas();
      setValorPagoReais((parcela.saldoCentavos / 100).toFixed(2).replace('.', ','));
      setJurosReais('0,00');
      setMultaReais('0,00');
      setDescontoReais('0,00');
      setNumeroDocumento(parcela.numeroDocumento || '');
      setObservacao('');
      setComprovantes([]);
      setAbaModal('dados');
      setErrorMsg(null);
    }
  }, [isOpen, parcela]);

  async function loadContas() {
    setLoading(true);
    const list = await erpRepository.getContasBancarias({ apenasAtivos: true });
    setContasBancarias(list);
    if (list.length > 0) setContaBancariaId(list[0].id);
    setLoading(false);
  }

  const parseCentavos = (valStr: string): number => {
    const clean = valStr.replace(/\./g, '').replace(',', '.');
    return Math.round((parseFloat(clean) || 0) * 100);
  };

  const valorPagoCentavos = parseCentavos(valorPagoReais);
  const jurosCentavos = parseCentavos(jurosReais);
  const multaCentavos = parseCentavos(multaReais);
  const descontoCentavos = parseCentavos(descontoReais);

  const valorLiquidoCentavos = valorPagoCentavos + jurosCentavos + multaCentavos - descontoCentavos;

  useEffect(() => {
    if (parcela && valorPagoCentavos > parcela.saldoCentavos) {
      setErrorMsg(
        `O valor pago (${formatCurrency(valorPagoCentavos)}) não pode ser maior que o saldo em aberto (${formatCurrency(parcela.saldoCentavos)}). Lance o excesso como Juros ou Multa.`
      );
    } else {
      setErrorMsg(null);
    }
  }, [valorPagoCentavos, parcela]);

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
        tipo: file.type || 'document'
      };
    });

    setComprovantes(prev => [...prev, ...novos]);
    toast.success(`${novos.length} comprovante(s) anexado(s) com sucesso`);
  };

  const handleRemoveComprovante = (id: string) => {
    setComprovantes(prev => prev.filter(c => c.id !== id));
    toast.info('Comprovante removido');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcela) return;

    // Guarda de reentrância: `loading` só cobria a carga inicial, então o botão
    // seguia ativo durante a gravação e um duplo clique baixava a parcela duas vezes.
    if (salvando) return;

    if (valorPagoCentavos <= 0) {
      setErrorMsg('Informe um valor pago maior que zero.');
      return;
    }

    if (valorPagoCentavos > parcela.saldoCentavos) {
      setErrorMsg('O valor pago não pode exceder o saldo da parcela.');
      return;
    }

    setSalvando(true);
    try {
      let observacaoFinal = observacao;
      if (comprovantes.length > 0) {
        const listaNomes = comprovantes.map(c => `${c.nome} (${c.tamanhoFormatted})`).join(', ');
        observacaoFinal += `\n[COMPROVANTES ANEXADOS: ${listaNomes}]`;
      }

      await erpRepository.createMovimento({
        parcelaId: parcela.parcelaId,
        dataPagamento,
        valorPagoCentavos,
        jurosCentavos,
        multaCentavos,
        descontoCentavos,
        contaBancariaId,
        formaPagamento,
        numeroDocumento,
        observacao: observacaoFinal
      });

      const msgSucesso = parcela.tipo === 'R' ? 'Recebimento registrado' : 'Pagamento registrado';
      const descSucesso = comprovantes.length > 0
        ? `${parcela.pessoaNome} — ${formatCurrency(valorPagoCentavos)} (${comprovantes.length} comprovante(s) anexado(s))`
        : `${parcela.pessoaNome} — ${formatCurrency(valorPagoCentavos)}`;

      toast.success(msgSucesso, { description: descSucesso });
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao efetuar a baixa.');
    } finally {
      setSalvando(false);
    }
  };

  const isRecebimento = parcela?.tipo === 'R';

  return (
    <Modal
      isOpen={isOpen && parcela !== null}
      onClose={onClose}
      title={isRecebimento ? 'Baixa de Conta a Receber' : 'Baixa de Conta a Pagar'}
      description="Liquidação efetiva de caixa e anexação de comprovantes"
      size="md"
      icon={
        <span
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isRecebimento ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          <DollarSign className="w-5 h-5" aria-hidden />
        </span>
      }
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] text-xs font-semibold text-ink-muted hover:text-ink-primary hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-baixa-parcela"
            disabled={Boolean(errorMsg) || loading || salvando}
            className="px-6 py-2 bg-brand hover:bg-brand-hover text-white rounded-[10px] text-xs font-bold shadow-md focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {salvando ? 'Gravando…' : `Confirmar Baixa${comprovantes.length > 0 ? ` (${comprovantes.length} anexos)` : ''}`}
          </button>
        </div>
      }
    >
      {parcela && (
        <div className="space-y-4">
          {/* Cabeçalho Somente Leitura da Parcela */}
          <div className="bg-surface-muted p-3.5 rounded-xl border border-black/5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-muted font-semibold">{isRecebimento ? 'Cliente:' : 'Fornecedor:'}</span>
              <span className="font-bold text-ink-primary truncate max-w-xs">{parcela.pessoaNome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted font-semibold">Documento / Ref:</span>
              <span className="font-mono">{parcela.numeroDocumento || 'S/N'} (Parc. {parcela.parcelaNumero}/{parcela.qtdParcelas})</span>
            </div>
            <div className="pt-2 border-t border-black/5 grid grid-cols-3 text-center">
              <div>
                <span className="text-[10px] text-ink-muted block uppercase">Valor Original</span>
                <span className="font-bold">{formatCurrency(parcela.valorCentavos)}</span>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted block uppercase">Já Baixado</span>
                <span className="font-bold text-emerald-600">{formatCurrency(parcela.valorBaixadoCentavos)}</span>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted block uppercase">Saldo em Aberto</span>
                <span className="font-bold text-brand">{formatCurrency(parcela.saldoCentavos)}</span>
              </div>
            </div>
          </div>

          {/* Abas do Modal: Dados da Baixa VS Comprovantes */}
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
              Dados da Baixa
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

          {/* Formulário Principal */}
          {loading ? (
            <div className="p-6 text-center text-ink-muted animate-pulse">Carregando contas bancárias...</div>
          ) : (
            <form id="form-baixa-parcela" onSubmit={handleSubmit} className="space-y-4">
              {abaModal === 'dados' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">
                        {isRecebimento ? 'Data do Recebimento *' : 'Data do Pagamento *'}
                      </label>
                      <input
                        type="date"
                        value={dataPagamento}
                        onChange={(e) => setDataPagamento(e.target.value)}
                        required
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Valor Baixado (R$) *</label>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={valorPagoReais}
                        onChange={(e) => setValorPagoReais(e.target.value)}
                        required
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary font-bold focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                  </div>

                  {/* Juros, Multa, Desconto */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted mb-1">Juros (R$)</label>
                      <input
                        type="text"
                        value={jurosReais}
                        onChange={(e) => setJurosReais(e.target.value)}
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-2.5 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted mb-1">Multa (R$)</label>
                      <input
                        type="text"
                        value={multaReais}
                        onChange={(e) => setMultaReais(e.target.value)}
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-2.5 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted mb-1">Desconto (R$)</label>
                      <input
                        type="text"
                        value={descontoReais}
                        onChange={(e) => setDescontoReais(e.target.value)}
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-2.5 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>

                  {/* Destaque do Valor Líquido Efetivo */}
                  <div className="p-3 bg-brand-light/50 border border-brand/20 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-primary">Valor Efetivo Movimentado na Conta:</span>
                    <span className="text-base font-bold text-brand">{formatCurrency(valorLiquidoCentavos)}</span>
                  </div>

                  {/* Conta Bancária & Forma de Pagamento */}
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
                            {cb.nome} ({formatCurrency(cb.saldoInicialCentavos)})
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Nº Comprovante / Doc</label>
                      <input
                        type="text"
                        placeholder="Nº Autenticação PIX / Doc"
                        value={numeroDocumento}
                        onChange={(e) => setNumeroDocumento(e.target.value)}
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Observações</label>
                      <input
                        type="text"
                        placeholder="Notas adicionais da baixa..."
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ABA: COMPROVANTES E ANEXOS */}
              {abaModal === 'comprovantes' && (
                <div className="space-y-4">
                  {/* Caixa de Upload */}
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
                      Clique ou arraste o comprovante {isRecebimento ? 'de recebimento' : 'de pagamento'} aqui
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Suporta arquivos PDF, Imagens (PNG/JPG) e Documentos
                    </span>
                  </label>

                  {/* Lista de Arquivos Anexados */}
                  {comprovantes.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200/60">
                      Nenhum comprovante anexado ainda para esta baixa.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      <span className="text-xs font-bold text-slate-700 block mb-1">
                        Comprovantes anexados ({comprovantes.length}):
                      </span>
                      {comprovantes.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-200 transition-colors shadow-2xs"
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

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

            </form>
          )}
        </div>
      )}
    </Modal>
  );
}
