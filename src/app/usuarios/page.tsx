'use client';

import React, { useState } from 'react';
import { useAuth, type EmailConfirmacaoPreview } from '@/context/AuthContext';
import { DOMINIO_PERMITIDO, DepartamentoId, UsuarioPerfil, RoleUsuario } from '@/data/types';
import { useToast } from '@/components/ui/ToastProvider';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building2,
  CheckCircle2,
  XCircle,
  KeyRound,
  Mail,
  Lock,
  Edit2,
  Eye,
  EyeOff,
  Copy,
  Check
} from 'lucide-react';

const LISTA_DEPARTAMENTOS: { id: DepartamentoId; nome: string; cor: string }[] = [
  { id: 'financeiro', nome: 'Financeiro', cor: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'comercial', nome: 'Comercial', cor: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'rh', nome: 'Recursos Humanos (RH)', cor: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'fiscal', nome: 'Fiscal & Impostos', cor: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'juridico', nome: 'Jurídico & Contratos', cor: 'bg-rose-100 text-rose-700 border-rose-200' },
];

export default function UsuariosPage() {
  const toast = useToast();
  const { user, usuariosCadastrados, cadastrarUsuario, atualizarUsuario } = useAuth();

  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioPerfil | null>(null);

  const [nome, setNome] = useState('');
  const [emailLocal, setEmailLocal] = useState('');
  const [cargo, setCargo] = useState('');
  const [role, setRole] = useState<RoleUsuario>('operador');
  const [isAcessoGeral, setIsAcessoGeral] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [deptosSelecionados, setDeptosSelecionados] = useState<DepartamentoId[]>(['financeiro']);
  const [saving, setSaving] = useState(false);

  // Controle de exibição de senhas na tabela
  const [senhasVisiveis, setSenhasVisiveis] = useState<Record<string, boolean>>({});

  // Modal Preview do E-mail e Senha Gerada
  const [modalEmailPreview, setModalEmailPreview] = useState<EmailConfirmacaoPreview | null>(null);
  const [modalSenhaGerada, setModalSenhaGerada] = useState<string | null>(null);

  // Apenas Administradores ou usuários com Acesso Geral Total podem acessar esta tela
  const isSuperAdmin = user?.isAcessoGeral || user?.role === 'administrador';

  if (!user || !isSuperAdmin) {
    return (
      <div className="pt-12 max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Acesso Restrito ao Administrador Geral</h1>
        <p className="text-xs text-slate-500 leading-relaxed px-4">
          Apenas usuários com <strong>Acesso Total (Super Administrador)</strong> têm autorização para cadastrar colaboradores, alterar permissões ou visualizar senhas temporárias.
        </p>
      </div>
    );
  }

  function toggleDepto(id: DepartamentoId) {
    if (deptosSelecionados.includes(id)) {
      setDeptosSelecionados(deptosSelecionados.filter(d => d !== id));
    } else {
      setDeptosSelecionados([...deptosSelecionados, id]);
    }
  }

  function toggleVisibilidadeSenha(userId: string) {
    setSenhasVisiveis(prev => ({ ...prev, [userId]: !prev[userId] }));
  }

  function abrirNovoModal() {
    setUsuarioEditando(null);
    setNome('');
    setEmailLocal('');
    setCargo('');
    setRole('operador');
    setIsAcessoGeral(false);
    setAtivo(true);
    setDeptosSelecionados(['financeiro']);
    setModalAberto(true);
  }

  function abrirEdicaoModal(u: UsuarioPerfil) {
    setUsuarioEditando(u);
    setNome(u.nome);
    const localEmail = u.email.replace(`@${DOMINIO_PERMITIDO}`, '');
    setEmailLocal(localEmail);
    setCargo(u.cargo);
    setRole(u.role);
    setIsAcessoGeral(u.isAcessoGeral);
    setAtivo(u.ativo);
    setDeptosSelecionados(u.departamentosPermitidos || ['financeiro']);
    setModalAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const emailCompleto = emailLocal.includes('@')
      ? emailLocal.trim().toLowerCase()
      : `${emailLocal.trim().toLowerCase()}@${DOMINIO_PERMITIDO}`;

    if (usuarioEditando) {
      // Edição de Usuário Existente
      const res = await atualizarUsuario(usuarioEditando.id, {
        nome,
        email: emailCompleto,
        cargo: cargo || 'Colaborador',
        role,
        isAcessoGeral: isAcessoGeral || role === 'administrador',
        departamentosPermitidos: isAcessoGeral || role === 'administrador'
          ? ['financeiro', 'comercial', 'rh', 'fiscal', 'juridico']
          : deptosSelecionados,
        ativo
      });

      setSaving(false);

      if (res.success) {
        toast.success(res.message);
        setModalAberto(false);
        setUsuarioEditando(null);
      } else {
        toast.error(res.message);
      }
    } else {
      // Cadastro de Novo Usuário
      const res = await cadastrarUsuario({
        nome,
        email: emailCompleto,
        cargo: cargo || 'Colaborador',
        role,
        isAcessoGeral: isAcessoGeral || role === 'administrador',
        departamentosPermitidos: isAcessoGeral || role === 'administrador'
          ? ['financeiro', 'comercial', 'rh', 'fiscal', 'juridico']
          : deptosSelecionados,
        ativo: true
      });

      setSaving(false);

      if (res.success) {
        toast.success(res.message);
        setModalAberto(false);

        if (res.emailPreview && res.senhaGerada) {
          setModalEmailPreview(res.emailPreview);
          setModalSenhaGerada(res.senhaGerada);
        }
      } else {
        toast.error(res.message);
      }
    }
  }

  return (
    <div className="pt-6 space-y-6">
      {/* Header */}
      <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand mb-1">
            <Users className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Gestão de Equipe & Segurança</span>
          </div>
          <h1 className="text-xl font-bold text-ink-primary tracking-tight">
            Usuários, Senhas & Permissões por Departamento
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Cadastre colaboradores da <strong>Delta Plano Bras</strong>, veja senhas geradas e gerencie acessos aos departamentos.
          </p>
        </div>

        <button
          type="button"
          onClick={abrirNovoModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs shadow-md transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Novo Usuário</span>
        </button>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/5 text-[11px] font-bold text-ink-muted uppercase tracking-wider">
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">E-mail Corporativo</th>
                <th className="py-3 px-4">Cargo / Perfil</th>
                <th className="py-3 px-4">Senha Temporária / Gerada</th>
                <th className="py-3 px-4">Departamentos Liberados</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 text-xs">
              {usuariosCadastrados.map((u) => {
                const senhaAtual = u.senhaTemporaria || '123456';
                const visivel = senhasVisiveis[u.id];

                return (
                  <tr key={u.id} className="hover:bg-black/[0.01] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-ink-primary">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand/10 text-brand font-bold flex items-center justify-center text-xs shrink-0">
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span>{u.nome}</span>
                          {u.email.includes('renan.administrativo') && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold">
                              Principal
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-ink-primary font-mono text-[11px]">
                      {u.email}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-700 block">{u.cargo}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{u.role}</span>
                    </td>
                    {/* Visualização de Senha Gerada (Apenas para Super Admins) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-purple-700 font-bold border border-slate-200">
                          {visivel ? senhaAtual : '••••••••'}
                        </code>
                        <button
                          type="button"
                          onClick={() => toggleVisibilidadeSenha(u.id)}
                          className="p-1 text-slate-400 hover:text-purple-600 transition-colors"
                          title={visivel ? 'Ocultar Senha' : 'Ver Senha Gerada'}
                        >
                          {visivel ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(senhaAtual);
                            toast.success(`Senha de ${u.nome} copiada!`);
                          }}
                          className="p-1 text-slate-400 hover:text-purple-600 transition-colors"
                          title="Copiar Senha"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.isAcessoGeral || u.role === 'administrador' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold border border-purple-200">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Acesso Geral Total
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.departamentosPermitidos?.map((d) => (
                            <span key={d} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 capitalize">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        u.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.ativo ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => abrirEdicaoModal(u)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 font-semibold transition-all inline-flex items-center gap-1 text-[11px]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro / Edição de Usuário */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-6 shadow-2xl border border-black/10 w-full max-w-lg space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div className="flex items-center gap-2 text-brand">
                {usuarioEditando ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                <h3 className="text-lg font-bold text-ink-primary">
                  {usuarioEditando ? `Editar Usuário: ${usuarioEditando.nome}` : 'Cadastrar Usuário Corporativo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvar} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  E-mail Corporativo (@{DOMINIO_PERMITIDO}) *
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    value={emailLocal}
                    onChange={(e) => setEmailLocal(e.target.value)}
                    placeholder="nome.sobrenome"
                    className="flex-1 p-2.5 border border-slate-200 rounded-l-xl text-xs focus:ring-1 focus:ring-brand focus:border-brand"
                  />
                  <span className="p-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-slate-600 font-mono text-[11px]">
                    @{DOMINIO_PERMITIDO}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cargo</label>
                  <input
                    type="text"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Ex: Gerente Financeiro"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-brand focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Perfil de Acesso</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as RoleUsuario)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:ring-1 focus:ring-brand focus:border-brand"
                  >
                    <option value="operador">Operador (Acesso aos setores marcados)</option>
                    <option value="gerente">Gerente de Setor</option>
                    <option value="administrador">Administrador Geral</option>
                  </select>
                </div>
              </div>

              {usuarioEditando && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status da Conta</label>
                  <select
                    value={ativo ? 'true' : 'false'}
                    onChange={(e) => setAtivo(e.target.value === 'true')}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:ring-1 focus:ring-brand focus:border-brand font-semibold"
                  >
                    <option value="true">Ativo (Pode acessar o sistema)</option>
                    <option value="false">Inativo (Acesso bloqueado)</option>
                  </select>
                </div>
              )}

              {role !== 'administrador' && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-700">Departamentos Permitidos</label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-purple-700 font-bold">
                      <input
                        type="checkbox"
                        checked={isAcessoGeral}
                        onChange={(e) => setIsAcessoGeral(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span>Acesso Geral a Todos</span>
                    </label>
                  </div>

                  {!isAcessoGeral && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {LISTA_DEPARTAMENTOS.map((d) => (
                        <label
                          key={d.id}
                          className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                            deptosSelecionados.includes(d.id)
                              ? 'bg-purple-50 border-purple-300 font-semibold'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={deptosSelecionados.includes(d.id)}
                            onChange={() => toggleDepto(d.id)}
                            className="rounded text-purple-600 focus:ring-purple-500"
                          />
                          <span>{d.nome}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold shadow-md transition-all"
                >
                  {saving ? 'Salvando...' : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Simulação/Envio do E-mail de Confirmação com Senha Automática */}
      {modalEmailPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 w-full max-w-xl space-y-4 animate-in fade-in zoom-in duration-200 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-purple-700 font-bold">
                <Mail className="w-5 h-5" />
                <span>E-mail de Confirmação Enviado com Sucesso!</span>
              </div>
              <button
                type="button"
                onClick={() => setModalEmailPreview(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-center justify-between">
              <div>
                <span className="font-semibold block">Senha Automática Gerada para o Usuário:</span>
                <code className="text-sm font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200 font-mono">
                  {modalSenhaGerada}
                </code>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (modalSenhaGerada) {
                    navigator.clipboard.writeText(modalSenhaGerada);
                    toast.success('Senha temporária copiada para a área de transferência!');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-sm"
              >
                Copiar Senha
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-xs max-h-80 overflow-y-auto space-y-3 text-slate-700">
              <p className="text-sm font-bold text-purple-700">Confirmação de Conta — ERP Melhor Gestão</p>
              <p>
                Olá, <strong>{modalEmailPreview.nome}</strong>! Sua conta corporativa na{' '}
                <strong>Delta Plano Bras</strong> foi criada com sucesso.
              </p>
              <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-1">
                <p><strong>E-mail:</strong> {modalEmailPreview.email}</p>
                <p>
                  <strong>Senha automática gerada:</strong>{' '}
                  <code className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-bold">
                    {modalEmailPreview.senhaGerada}
                  </code>
                </p>
              </div>
              <p>Link de confirmação enviado ao usuário:</p>
              <a
                href={modalEmailPreview.confirmUrl}
                className="block break-all text-purple-700 underline"
              >
                {modalEmailPreview.confirmUrl}
              </a>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalEmailPreview(null)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all"
              >
                Entendido / Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
