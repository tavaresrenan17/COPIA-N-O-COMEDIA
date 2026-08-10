'use client';

import { useEffect, useState } from 'react';
import { erpRepository, ContaBancaria, TipoContaBancaria } from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { Search, Plus, X, Landmark, Wallet, Edit2, Trash2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ContasBancariasPage() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [apenasAtivos, setApenasAtivos] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState<TipoContaBancaria>('corrente');
  const [formBanco, setFormBanco] = useState('');
  const [formAgencia, setFormAgencia] = useState('');
  const [formConta, setFormConta] = useState('');
  const [formSaldoInicialReais, setFormSaldoInicialReais] = useState('0,00');
  const [formDataSaldoInicial, setFormDataSaldoInicial] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, [apenasAtivos]);

  async function loadData() {
    setLoading(true);
    const data = await erpRepository.getContasBancarias({ apenasAtivos });
    setContas(data);
    setLoading(false);
  }

  const handleOpenNewModal = () => {
    setEditingId(null);
    setFormNome('');
    setFormTipo('corrente');
    setFormBanco('');
    setFormAgencia('');
    setFormConta('');
    setFormSaldoInicialReais('0,00');
    setFormDataSaldoInicial(new Date().toISOString().split('T')[0]);
    setModalOpen(true);
  };

  const handleOpenEditModal = (cb: ContaBancaria) => {
    setEditingId(cb.id);
    setFormNome(cb.nome);
    setFormTipo(cb.tipo);
    setFormBanco(cb.banco || '');
    setFormAgencia(cb.agencia || '');
    setFormConta(cb.conta || '');
    setFormSaldoInicialReais((cb.saldoInicialCentavos / 100).toFixed(2).replace('.', ','));
    setFormDataSaldoInicial(cb.dataSaldoInicial);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanReais = formSaldoInicialReais.replace(/\./g, '').replace(',', '.');
    const saldoInicialCentavos = Math.round(parseFloat(cleanReais) * 100) || 0;

    const payload = {
      nome: formNome,
      tipo: formTipo,
      banco: formBanco,
      agencia: formAgencia,
      conta: formConta,
      saldoInicialCentavos,
      dataSaldoInicial: formDataSaldoInicial,
      ativo: true
    };

    if (editingId) {
      await erpRepository.updateContaBancaria(editingId, payload);
    } else {
      await erpRepository.createContaBancaria(payload);
    }

    setModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja desativar esta conta bancária? (Soft delete)')) {
      await erpRepository.deleteContaBancaria(id);
      loadData();
    }
  };

  const getTipoBadge = (tipo: TipoContaBancaria) => {
    switch (tipo) {
      case 'corrente':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">Conta Corrente</span>;
      case 'poupanca':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">Poupança</span>;
      case 'caixa':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">Caixa Interno</span>;
      case 'aplicacao':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 uppercase">Aplicação</span>;
    }
  };

  const filteredContas = contas.filter((c) => {
    if (!searchTerm) return true;
    return (
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.banco && c.banco.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.conta && c.conta.includes(searchTerm))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">Contas Bancárias & Caixa</h1>
          <p className="text-xs text-ink-muted mt-1">
            Gestão de contas correntes, aplicações financeiras e caixas internos com saldo inicial e dados bancários.
          </p>
        </div>
        <button
          onClick={handleOpenNewModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Conta Bancária</span>
        </button>
      </div>

      {/* Busca e Filtro */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:w-80">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por banco, conta ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface border border-black/[0.06] rounded-xl pl-10 pr-4 py-2 text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 shadow-soft"
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted bg-surface px-3 py-2 rounded-xl border border-black/[0.06] shadow-soft cursor-pointer">
          <input
            type="checkbox"
            checked={apenasAtivos}
            onChange={(e) => setApenasAtivos(e.target.checked)}
            className="rounded border-gray-300 text-brand focus:ring-brand"
          />
          Apenas Ativas
        </label>
      </div>

      {/* Cards de Contas Bancárias */}
      {loading ? (
        <div className="p-12 text-center text-ink-muted font-medium bg-surface rounded-2xl border border-black/[0.03]">
          Carregando contas bancárias...
        </div>
      ) : filteredContas.length === 0 ? (
        <div className="p-12 text-center text-ink-muted bg-surface rounded-2xl border border-black/[0.03]">
          Nenhuma conta bancária cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredContas.map((cb) => (
            <div
              key={cb.id}
              className={`bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] flex flex-col justify-between hover:shadow-elevated transition-all ${
                !cb.ativo ? 'opacity-50' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-brand-light text-brand">
                      {cb.tipo === 'caixa' ? <Wallet className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-ink-primary leading-snug">{cb.nome}</h3>
                      <span className="text-[11px] text-ink-muted">{cb.banco || 'Sem banco'}</span>
                    </div>
                  </div>
                  {getTipoBadge(cb.tipo)}
                </div>

                <div className="space-y-1 py-2 text-xs border-y border-black/[0.04] my-3">
                  <div className="flex justify-between text-ink-muted">
                    <span>Agência / Conta:</span>
                    <span className="font-mono text-ink-primary font-semibold">
                      {cb.agencia || '-'} / {cb.conta || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <span>Data Saldo Inicial:</span>
                    <span>{cb.dataSaldoInicial}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block">
                    Saldo Inicial
                  </span>
                  <span className="text-xl font-bold text-ink-primary tracking-tight">
                    {formatCurrency(cb.saldoInicialCentavos)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-1 pt-4 mt-2 border-t border-black/[0.03]">
                <button
                  onClick={() => handleOpenEditModal(cb)}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-black/5 transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(cb.id)}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Formulário de Conta Bancária */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl border border-black/10"
            >
              <div className="flex items-center justify-between mb-5 border-b border-black/5 pb-3">
                <h3 className="text-lg font-bold text-ink-primary">
                  {editingId ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
                </h3>
                <button onClick={() => setModalOpen(false)} className="text-ink-muted hover:text-ink-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Nome da Conta / Identificador *</label>
                  <input
                    type="text"
                    placeholder="Ex: Itaú Conta Principal"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Tipo de Conta *</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as TipoContaBancaria)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="caixa">Caixa Interno (Tesouraria)</option>
                    <option value="aplicacao">Aplicação Financeira</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Instituição Bancária</label>
                  <input
                    type="text"
                    placeholder="Ex: Banco Itaú"
                    value={formBanco}
                    onChange={(e) => setFormBanco(e.target.value)}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Agência</label>
                    <input
                      type="text"
                      placeholder="0456"
                      value={formAgencia}
                      onChange={(e) => setFormAgencia(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Número da Conta</label>
                    <input
                      type="text"
                      placeholder="12345-6"
                      value={formConta}
                      onChange={(e) => setFormConta(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Saldo Inicial (R$) *</label>
                    <input
                      type="text"
                      placeholder="15000,00"
                      value={formSaldoInicialReais}
                      onChange={(e) => setFormSaldoInicialReais(e.target.value)}
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Data Saldo Inicial *</label>
                    <input
                      type="date"
                      value={formDataSaldoInicial}
                      onChange={(e) => setFormDataSaldoInicial(e.target.value)}
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-black/5">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98]"
                  >
                    Salvar Conta Bancária
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
