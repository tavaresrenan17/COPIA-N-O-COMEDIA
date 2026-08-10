'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';
import {
  User,
  KeyRound,
  ShieldCheck,
  Building2,
  Mail,
  CheckCircle2,
  Lock,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';

export default function PerfilPage() {
  const toast = useToast();
  const { user, alterarSenha } = useAuth();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <div className="pt-8 text-center text-slate-500">
        Carregando informações do perfil...
      </div>
    );
  }

  async function handleSalvarNovaSenha(e: React.FormEvent) {
    e.preventDefault();

    if (novaSenha !== confirmarNovaSenha) {
      toast.error('A confirmação da nova senha não confere com a nova senha digitada.');
      return;
    }

    if (novaSenha.length < 6) {
      toast.error('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    setSaving(true);
    const res = await alterarSenha(senhaAtual, novaSenha);
    setSaving(false);

    if (res.success) {
      toast.success(res.message);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
    } else {
      toast.error(res.message);
    }
  }

  return (
    <div className="pt-6 max-w-4xl mx-auto space-y-6">
      {/* Banner de Perfil */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand to-purple-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg ring-4 ring-white/10">
              {user.nome.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">{user.nome}</h1>
                {user.isAcessoGeral && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 text-[11px] font-bold border border-purple-400/30">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-300" />
                    Acesso Geral Total
                  </span>
                )}
              </div>
              <p className="text-sm text-purple-200/80 flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400" />
                <span className="font-mono text-xs">{user.email}</span>
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs">
            <span className="text-purple-300 block font-semibold text-[10px] uppercase tracking-wider">Cargo & Perfil</span>
            <span className="text-white font-bold">{user.cargo}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulário de Alteração de Senha */}
        <div className="lg:col-span-7 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-4">
          <div className="flex items-center gap-2 text-brand border-b border-black/5 pb-3">
            <KeyRound className="w-5 h-5" />
            <h2 className="text-base font-bold text-ink-primary">Alterar Senha de Acesso</h2>
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            Se você recebeu uma <strong>senha automática gerada no cadastro</strong> (ex: <code>Delta#8f3a</code>), utilize-a no campo abaixo para cadastrar sua nova senha pessoal.
          </p>

          <form onSubmit={handleSalvarNovaSenha} className="space-y-4 text-xs pt-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Senha Atual / Temporária Gerada *
              </label>
              <div className="relative">
                <input
                  type={mostrarSenhas ? 'text' : 'password'}
                  required
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="Digite a senha atual ou a senha temporária gerada"
                  className="w-full p-3 pr-10 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-brand focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenhas(!mostrarSenhas)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {mostrarSenhas ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nova Senha Pessoal *
              </label>
              <input
                type={mostrarSenhas ? 'text' : 'password'}
                required
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="No mínimo 6 caracteres"
                className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Confirmar Nova Senha Pessoal *
              </label>
              <input
                type={mostrarSenhas ? 'text' : 'password'}
                required
                value={confirmarNovaSenha}
                onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                placeholder="Repita a nova senha criada"
                className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-brand focus:border-brand"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{saving ? 'Alterando Senha...' : 'Salvar Nova Senha'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Permissões e Departamentos Liberados */}
        <div className="lg:col-span-5 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] space-y-4">
          <div className="flex items-center gap-2 text-brand border-b border-black/5 pb-3">
            <Building2 className="w-5 h-5" />
            <h2 className="text-base font-bold text-ink-primary">Permissões de Departamentos</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-semibold block text-[11px]">Seu Perfil de Acesso</span>
              <span className="text-slate-800 font-bold capitalize text-sm">{user.role}</span>
            </div>

            <div>
              <span className="text-slate-500 font-semibold block text-[11px] mb-2">Departamentos Liberados na Barra Lateral</span>
              {user.isAcessoGeral || user.role === 'administrador' ? (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Acesso irrestrito a todos os setores corporativos</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {user.departamentosPermitidos.map((d) => (
                    <span key={d} className="px-3 py-1 rounded-lg bg-brand/10 text-brand font-bold text-xs capitalize border border-brand/20">
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
