'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { erpRepository, Pessoa, TipoPessoa } from '@/data';
import { validarDocumentoPorTipo, mascararDocumento, formatarCPFouCNPJ } from '@/lib/validations';
import { Search, Plus, Building2, User, ShieldAlert, Edit2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

export default function PessoasPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabFiltro, setTabFiltro] = useState<'TODOS' | 'CLIENTES' | 'FORNECEDORES'>('TODOS');
  const [apenasAtivos, setApenasAtivos] = useState(true);

  // Modal de Formulário
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPessoaId, setEditingPessoaId] = useState<string | null>(null);

  // Estado do Formulário
  const [formCpfCnpj, setFormCpfCnpj] = useState('');
  const [formTipoPessoa, setFormTipoPessoa] = useState<TipoPessoa>('J');
  const [formNome, setFormNome] = useState('');
  const [formNomeFantasia, setFormNomeFantasia] = useState('');
  const [formInscricaoEstadual, setFormInscricaoEstadual] = useState('');
  const [formDataNascimento, setFormDataNascimento] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formCidade, setFormCidade] = useState('');
  const [formUf, setFormUf] = useState('');
  const [formIsCliente, setFormIsCliente] = useState(true);
  const [formIsFornecedor, setFormIsFornecedor] = useState(false);
  const [formBanco, setFormBanco] = useState('');
  const [formAgencia, setFormAgencia] = useState('');
  const [formConta, setFormConta] = useState('');
  const [formChavePix, setFormChavePix] = useState('');
  const [formCondicaoPagamento, setFormCondicaoPagamento] = useState('30');
  const [formObservacao, setFormObservacao] = useState('');

  // Erro de Validação de Documento
  const [docError, setDocError] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  /** Retrato de todos os campos, usado para detectar alterações não salvas. */
  const formSnapshot = useMemo(
    () =>
      JSON.stringify([
        formCpfCnpj, formTipoPessoa, formNome, formNomeFantasia, formInscricaoEstadual,
        formDataNascimento, formEmail, formTelefone, formCidade, formUf,
        formIsCliente, formIsFornecedor, formBanco, formAgencia, formConta,
        formChavePix, formCondicaoPagamento, formObservacao,
      ]),
    [
      formCpfCnpj, formTipoPessoa, formNome, formNomeFantasia, formInscricaoEstadual,
      formDataNascimento, formEmail, formTelefone, formCidade, formUf,
      formIsCliente, formIsFornecedor, formBanco, formAgencia, formConta,
      formChavePix, formCondicaoPagamento, formObservacao,
    ],
  );
  const snapshotOriginal = useRef(formSnapshot);
  const isDirty = modalOpen && formSnapshot !== snapshotOriginal.current;

  const { guard } = useUnsavedChanges(isDirty);

  const loadPessoas = useCallback(async () => {
    setLoading(true);
    setErroCarregamento(null);
    try {
      setPessoas(await erpRepository.getPessoas({ apenasAtivos }));
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Não foi possível carregar os cadastros.';
      setErroCarregamento(mensagem);
      toast.error('Erro ao carregar cadastros', { description: mensagem });
    } finally {
      setLoading(false);
    }
  }, [apenasAtivos, toast]);

  useEffect(() => {
    loadPessoas();
  }, [loadPessoas]);

  // Fixa a linha de base assim que o modal abre. Os setters de campo e o
  // setModalOpen(true) são agrupados no mesmo render, então aqui os campos
  // já refletem o registro carregado.
  useEffect(() => {
    if (modalOpen) snapshotOriginal.current = formSnapshot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  const handleOpenNewModal = () => {
    setEditingPessoaId(null);
    setFormCpfCnpj('');
    setFormTipoPessoa('J');
    setFormNome('');
    setFormNomeFantasia('');
    setFormInscricaoEstadual('');
    setFormDataNascimento('');
    setFormEmail('');
    setFormTelefone('');
    setFormCidade('');
    setFormUf('');
    setFormIsCliente(true);
    setFormIsFornecedor(false);
    setFormBanco('');
    setFormAgencia('');
    setFormConta('');
    setFormChavePix('');
    setFormCondicaoPagamento('30');
    setFormObservacao('');
    setDocError(null);
    setFlagError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (p: Pessoa) => {
    setEditingPessoaId(p.id);
    setFormCpfCnpj(p.cpfCnpj);
    setFormTipoPessoa(p.tipoPessoa);
    setFormNome(p.nome);
    setFormNomeFantasia(p.nomeFantasia || '');
    setFormInscricaoEstadual(p.inscricaoEstadual || '');
    setFormDataNascimento(p.dataNascimento || '');
    setFormEmail(p.email || '');
    setFormTelefone(p.telefone || '');
    setFormCidade(p.cidade || '');
    setFormUf(p.uf || '');
    setFormIsCliente(p.isCliente);
    setFormIsFornecedor(p.isFornecedor);
    setFormBanco(p.banco || '');
    setFormAgencia(p.agencia || '');
    setFormConta(p.conta || '');
    setFormChavePix(p.chavePix || '');
    setFormCondicaoPagamento(String(p.condicaoPagamentoPadrao || 0));
    setFormObservacao(p.observacao || '');
    setDocError(null);
    setFlagError(null);
    setModalOpen(true);
  };

  /** Troca entre CPF (F) e CNPJ (J) — remascara o que já foi digitado. */
  const handleTipoPessoaChange = (tipo: TipoPessoa) => {
    setFormTipoPessoa(tipo);
    setFormCpfCnpj(mascararDocumento(formCpfCnpj, tipo));
    setDocError(null);
  };

  const handleDocumentoChange = (val: string) => {
    const mascarado = mascararDocumento(val, formTipoPessoa);
    setFormCpfCnpj(mascarado);

    const digitos = mascarado.replace(/\D/g, '').length;
    if (digitos === (formTipoPessoa === 'F' ? 11 : 14)) {
      const res = validarDocumentoPorTipo(mascarado, formTipoPessoa);
      setDocError(res.valido ? null : res.mensagem || 'Documento inválido');
    } else {
      setDocError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação de Flags
    if (!formIsCliente && !formIsFornecedor) {
      setFlagError('Marque ao menos uma das opções: Cliente ou Fornecedor.');
      return;
    }
    setFlagError(null);

    // Validação de DV de Documento conforme o tipo selecionado (CPF ou CNPJ)
    const docCheck = validarDocumentoPorTipo(formCpfCnpj, formTipoPessoa);
    if (!docCheck.valido) {
      setDocError(docCheck.mensagem || 'Documento inválido');
      return;
    }

    const payload = {
      cpfCnpj: formatarCPFouCNPJ(formCpfCnpj),
      tipoPessoa: formTipoPessoa,
      nome: formNome,
      nomeFantasia: formNomeFantasia,
      inscricaoEstadual: formInscricaoEstadual,
      dataNascimento: formDataNascimento || undefined,
      email: formEmail,
      telefone: formTelefone,
      cidade: formCidade,
      uf: formUf,
      isCliente: formIsCliente,
      isFornecedor: formIsFornecedor,
      banco: formBanco,
      agencia: formAgencia,
      conta: formConta,
      chavePix: formChavePix,
      condicaoPagamentoPadrao: parseInt(formCondicaoPagamento) || 0,
      observacao: formObservacao,
      ativo: true
    };

    if (salvando) return;
    setSalvando(true);
    try {
      if (editingPessoaId) {
        await erpRepository.updatePessoa(editingPessoaId, payload);
        toast.success('Cadastro atualizado', { description: payload.nome });
      } else {
        await erpRepository.createPessoa(payload);
        toast.success('Cadastro criado', { description: payload.nome });
      }

      setModalOpen(false);
      await loadPessoas();
    } catch (err) {
      toast.error(editingPessoaId ? 'Erro ao atualizar cadastro' : 'Erro ao criar cadastro', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async (pessoa: Pessoa) => {
    const vinculos = [pessoa.isCliente && 'cliente', pessoa.isFornecedor && 'fornecedor']
      .filter(Boolean)
      .join(' e ');

    const confirmado = await confirm({
      title: 'Desativar este credor?',
      description:
        'O registro não é apagado (soft delete): ele deixa de aparecer nas listagens e não pode mais ser usado em novos lançamentos. Os títulos já existentes são preservados.',
      detail: (
        <div className="rounded-xl bg-surface-muted px-4 py-3">
          <p className="font-bold text-ink-primary">{pessoa.nome}</p>
          <p className="mt-0.5 text-xs text-ink-muted font-mono">{pessoa.cpfCnpj}</p>
          {vinculos && <p className="mt-1.5 text-xs text-ink-muted">Cadastrado como {vinculos}.</p>}
        </div>
      ),
      confirmLabel: 'Desativar cadastro',
      variant: 'danger',
    });
    if (!confirmado) return;

    try {
      await erpRepository.deletePessoa(pessoa.id);
      toast.success('Cadastro desativado', { description: pessoa.nome });
      await loadPessoas();
    } catch (err) {
      toast.error('Erro ao desativar cadastro', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  };

  const filteredPessoas = pessoas.filter((p) => {
    // Filtro por Tab
    if (tabFiltro === 'CLIENTES' && !p.isCliente) return false;
    if (tabFiltro === 'FORNECEDORES' && !p.isFornecedor) return false;

    // Filtro de Pesquisa
    const matchSearch =
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cpfCnpj.includes(searchTerm) ||
      (p.nomeFantasia && p.nomeFantasia.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header com Boas Vindas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">Cadastro de Credores</h1>
          <p className="text-xs text-ink-muted mt-1">
            Base unificada de Clientes e Fornecedores com controle de CNPJ/CPF, dados bancários e flags operacionais.
          </p>
        </div>
        <button
          onClick={handleOpenNewModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Credor</span>
        </button>
      </div>

      {/* Controles: Abas (Todos, Clientes, Fornecedores) + Busca + Filtro Ativo */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Abas Rápidas */}
        <div className="flex items-center gap-1 bg-surface border border-black/[0.06] p-1.5 rounded-xl shadow-soft w-full sm:w-auto">
          <button
            onClick={() => setTabFiltro('TODOS')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tabFiltro === 'TODOS' ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:text-ink-primary'
            }`}
          >
            Todos ({pessoas.length})
          </button>
          <button
            onClick={() => setTabFiltro('CLIENTES')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tabFiltro === 'CLIENTES' ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:text-ink-primary'
            }`}
          >
            Clientes ({pessoas.filter(p => p.isCliente).length})
          </button>
          <button
            onClick={() => setTabFiltro('FORNECEDORES')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tabFiltro === 'FORNECEDORES' ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:text-ink-primary'
            }`}
          >
            Fornecedores ({pessoas.filter(p => p.isFornecedor).length})
          </button>
        </div>

        {/* Busca e Ativos */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF/CNPJ..."
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
            Apenas Ativos
          </label>
        </div>
      </div>

      {/* Tabela de Credores */}
      <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.03] overflow-hidden">
        {erroCarregamento ? (
          <div className="p-12 text-center">
            <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-ink-primary">
              Não foi possível carregar os cadastros
            </p>
            <p className="mt-1 text-xs text-ink-muted">{erroCarregamento}</p>
            <button
              type="button"
              onClick={loadPessoas}
              className="mt-4 px-4 py-2 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-ink-muted font-medium animate-pulse">Carregando cadastros...</div>
        ) : filteredPessoas.length === 0 ? (
          <div className="p-12 text-center text-ink-muted">Nenhum credor encontrado com os filtros aplicados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-muted text-[11px] font-bold uppercase tracking-wider text-ink-muted border-b border-black/[0.05]">
                  <th className="py-3 px-4">Razão Social / Nome</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">CPF / CNPJ</th>
                  <th className="py-3 px-4">Vínculo</th>
                  <th className="py-3 px-4">Cidade/UF</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03] text-xs font-medium text-ink-primary">
                {filteredPessoas.map((p) => (
                  <tr key={p.id} className="hover:bg-black/[0.01] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-ink-primary">
                      {p.nome}
                      {p.nomeFantasia && (
                        <span className="block text-[11px] font-normal text-ink-muted">
                          {p.nomeFantasia}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-muted text-ink-muted border border-black/[0.06]">
                        {p.tipoPessoa === 'F' ? (
                          <>
                            <User className="w-3 h-3" /> CPF
                          </>
                        ) : (
                          <>
                            <Building2 className="w-3 h-3" /> CNPJ
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-ink-muted">{formatarCPFouCNPJ(p.cpfCnpj)}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex gap-1.5">
                        {p.isCliente && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Cliente
                          </span>
                        )}
                        {p.isFornecedor && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Fornecedor
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-ink-muted">
                      {p.cidade ? `${p.cidade}/${p.uf || ''}` : 'Não informada'}
                    </td>
                    <td className="py-3.5 px-4 text-ink-muted">
                      {p.email || p.telefone || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.ativo ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                          title="Editar"
                          aria-label={`Editar cadastro de ${p.nome}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                          title="Desativar"
                          aria-label={`Desativar cadastro de ${p.nome}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Formulário de Criar/Editar Credor */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        dismissible={!isDirty}
        onDismissAttempt={() => guard(() => setModalOpen(false))}
        title={editingPessoaId ? 'Editar Cadastro de Credor' : 'Novo Cadastro de Credor'}
        description="Clientes e fornecedores compartilham o mesmo cadastro, diferenciados pelas flags de vínculo."
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => guard(() => setModalOpen(false))}
              className="px-4 py-2 rounded-[10px] text-xs font-semibold text-ink-muted hover:text-ink-primary hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-pessoa"
              disabled={salvando}
              className="px-5 py-2 bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-[10px] text-xs font-bold shadow-md focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 active:scale-[0.98] transition-colors"
            >
              {salvando ? 'Salvando...' : 'Salvar Cadastro'}
            </button>
          </div>
        }
      >
        <form id="form-pessoa" onSubmit={handleSubmit} className="space-y-4">
                {/* 1. Flags Obrigatórias (Regra de Ouro #2) */}
                <div className="bg-surface-muted p-3.5 rounded-xl border border-black/5">
                  <label className="block text-xs font-bold text-ink-primary mb-2">
                    Tipo de Vínculo (Obrigatório selecionar ao menos uma flag)
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs font-bold text-ink-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsCliente}
                        onChange={(e) => setFormIsCliente(e.target.checked)}
                        className="rounded border-gray-300 text-brand focus:ring-brand w-4 h-4"
                      />
                      <span>É Cliente</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-ink-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsFornecedor}
                        onChange={(e) => setFormIsFornecedor(e.target.checked)}
                        className="rounded border-gray-300 text-brand focus:ring-brand w-4 h-4"
                      />
                      <span>É Fornecedor</span>
                    </label>
                  </div>
                  {flagError && (
                    <p className="text-[11px] font-semibold text-rose-600 mt-2 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {flagError}
                    </p>
                  )}
                </div>

                {/* 2. Tipo de Documento (CPF ou CNPJ) */}
                <div className="bg-surface-muted p-3.5 rounded-xl border border-black/5">
                  <label className="block text-xs font-bold text-ink-primary mb-2">
                    Tipo de Documento *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleTipoPessoaChange('J')}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all active:scale-[0.98] ${
                        formTipoPessoa === 'J'
                          ? 'bg-brand text-white border-brand shadow-sm'
                          : 'bg-surface text-ink-muted border-black/10 hover:text-ink-primary'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      CNPJ (Pessoa Jurídica)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTipoPessoaChange('F')}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all active:scale-[0.98] ${
                        formTipoPessoa === 'F'
                          ? 'bg-brand text-white border-brand shadow-sm'
                          : 'bg-surface text-ink-muted border-black/10 hover:text-ink-primary'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      CPF (Pessoa Física)
                    </button>
                  </div>
                </div>

                {/* 3. Dados Básicos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">
                      {formTipoPessoa === 'F' ? 'CPF *' : 'CNPJ *'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={formTipoPessoa === 'F' ? '123.456.789-09' : '12.345.678/0001-90'}
                      value={formCpfCnpj}
                      onChange={(e) => handleDocumentoChange(e.target.value)}
                      required
                      className={`w-full bg-surface-muted border rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 ${
                        docError ? 'border-rose-500 focus:ring-rose-400' : 'border-black/10 focus:ring-brand'
                      }`}
                    />
                    {docError && (
                      <p className="text-[11px] font-semibold text-rose-600 mt-1">{docError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">
                      {formTipoPessoa === 'F' ? 'Nome Completo *' : 'Razão Social *'}
                    </label>
                    <input
                      type="text"
                      placeholder={formTipoPessoa === 'F' ? 'Nome do credor' : 'Nome da empresa'}
                      value={formNome}
                      onChange={(e) => setFormNome(e.target.value)}
                      required
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Nome Fantasia</label>
                    <input
                      type="text"
                      value={formNomeFantasia}
                      onChange={(e) => setFormNomeFantasia(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Inscrição Estadual</label>
                    <input
                      type="text"
                      value={formInscricaoEstadual}
                      onChange={(e) => setFormInscricaoEstadual(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                {/* Aniversário */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">
                      Data de nascimento / fundação
                    </label>
                    <input
                      type="date"
                      value={formDataNascimento}
                      onChange={(e) => setFormDataNascimento(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                {/* Contato & Localização */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">E-mail</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Telefone</label>
                    <input
                      type="text"
                      value={formTelefone}
                      onChange={(e) => setFormTelefone(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Cidade / UF</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Cidade"
                        value={formCidade}
                        onChange={(e) => setFormCidade(e.target.value)}
                        className="w-2/3 bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                      <input
                        type="text"
                        placeholder="UF"
                        maxLength={2}
                        value={formUf}
                        onChange={(e) => setFormUf(e.target.value.toUpperCase())}
                        className="w-1/3 bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand text-center uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados Bancários & Condições */}
                <div className="border-t border-black/5 pt-3">
                  <span className="block text-xs font-bold text-ink-primary mb-2">Dados Bancários & PIX</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted mb-1">Banco</label>
                      <input
                        type="text"
                        placeholder="Ex: Itaú"
                        value={formBanco}
                        onChange={(e) => setFormBanco(e.target.value)}
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted mb-1">Agência</label>
                      <input
                        type="text"
                        placeholder="0001"
                        value={formAgencia}
                        onChange={(e) => setFormAgencia(e.target.value)}
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted mb-1">Conta</label>
                      <input
                        type="text"
                        placeholder="12345-6"
                        value={formConta}
                        onChange={(e) => setFormConta(e.target.value)}
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-ink-muted mb-1">Chave PIX</label>
                      <input
                        type="text"
                        placeholder="E-mail / CNPJ"
                        value={formChavePix}
                        onChange={(e) => setFormChavePix(e.target.value)}
                        className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Prazo de Pagamento Padrão (Dias)</label>
                    <input
                      type="number"
                      min="0"
                      value={formCondicaoPagamento}
                      onChange={(e) => setFormCondicaoPagamento(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">Observações</label>
                    <input
                      type="text"
                      placeholder="Informações adicionais..."
                      value={formObservacao}
                      onChange={(e) => setFormObservacao(e.target.value)}
                      className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

        </form>
      </Modal>
    </div>
  );
}
