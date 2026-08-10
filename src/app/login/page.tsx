'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DOMINIO_PERMITIDO } from '@/data/types';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Building2,
  KeyRound,
  UserCheck
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Se já estiver logado, redireciona para a home
  if (user) {
    router.push('/');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        router.push('/');
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao efetuar login.');
    } finally {
      setLoading(false);
    }
  }

  function preencherDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('123456');
    setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F0D1B] overflow-y-auto p-4 sm:p-6">
      {/* Luzes de fundo com gradientes HSL vibrantes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-5xl bg-[#171526]/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Painel Esquerdo: Brand Hero */}
        <div className="lg:col-span-5 p-8 lg:p-12 bg-gradient-to-br from-purple-950/80 via-slate-900/90 to-indigo-950/80 text-white flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center gap-3 mb-8">
              <img
                src="/logo.png"
                alt="MVP Sistema ERP — Delta Plano Bras"
                className="h-20 w-auto max-w-[280px] object-contain drop-shadow-[0_6px_24px_rgba(124,77,255,0.45)]"
              />
            </div>

            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-400/30">
                <Sparkles className="w-3.5 h-3.5" />
                Ambiente Corporativo
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
                Controle e Autenticação de Acesso
              </h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                Acesso seguro com autenticação por e-mail corporativo e permissões restritas aos módulos por departamento.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 space-y-3">
            <div className="flex items-center gap-3 text-xs text-purple-200/80">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Domínio exclusivo: <strong>@{DOMINIO_PERMITIDO}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-xs text-purple-200/80">
              <UserCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Perfis com acessos restritos por setor</span>
            </div>
          </div>
        </div>

        {/* Painel Direito: Formulário de Login */}
        <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-between bg-[#171526]/50">
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Acesse sua conta
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Digite seu e-mail corporativo terminando em <strong className="text-purple-300">@{DOMINIO_PERMITIDO}</strong>
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`usuario@${DOMINIO_PERMITIDO}`}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <span>Autenticando...</span>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Atalho Rápido para Testes */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Acesso Rápido para Testes (1-Clique)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => preencherDemo(`renan.administrativo@${DOMINIO_PERMITIDO}`)}
                className="p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/20 text-left transition-all group"
              >
                <div className="text-xs font-bold text-purple-200 group-hover:text-white flex items-center justify-between">
                  <span>Renan (Admin)</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <span className="text-[10px] text-purple-300/70 block mt-0.5 truncate">
                  Acesso Geral Total
                </span>
              </button>

              <button
                type="button"
                onClick={() => preencherDemo(`financeiro@${DOMINIO_PERMITIDO}`)}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all group"
              >
                <div className="text-xs font-bold text-slate-200 group-hover:text-white flex items-center justify-between">
                  <span>Financeiro</span>
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                  Setor Financeiro
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
