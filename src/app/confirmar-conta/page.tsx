'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  CheckCircle2,
  XCircle,
  Building2,
  ArrowRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

function ConfirmarContaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { confirmarConta } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sucesso, setSucesso] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    const token = searchParams.get('token') || 'demo';
    async function executarAtivacao() {
      setLoading(true);
      const res = await confirmarConta(token);
      setSucesso(res.success);
      setMensagem(res.message);
      setLoading(false);
    }
    executarAtivacao();
  }, [searchParams]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F0D1B] p-4">
      <div className="w-full max-w-md bg-[#171526] border border-white/10 rounded-3xl p-8 shadow-2xl text-center space-y-6 text-white relative overflow-hidden backdrop-blur-xl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/30">
          <Building2 className="w-8 h-8 text-white" />
        </div>

        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Confirmação de E-mail Corporativo</h1>
          <p className="text-xs text-slate-400 mt-1">Delta Plano Bras — Sistema ERP Melhor Gestão</p>
        </div>

        {loading ? (
          <div className="py-8 space-y-3">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Validando token e ativando conta...</p>
          </div>
        ) : sucesso ? (
          <div className="py-4 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                Conta Ativada com Sucesso
              </span>
              <p className="text-xs text-slate-300 leading-relaxed px-2">
                {mensagem}
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
            >
              <span>Ir para a Tela de Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="py-4 space-y-5">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10" />
            </div>

            <p className="text-xs text-rose-300 leading-relaxed">{mensagem}</p>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all"
            >
              Voltar ao Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConfirmarContaPage() {
  return (
    <Suspense fallback={<div className="text-white text-center pt-20">Carregando...</div>}>
      <ConfirmarContaContent />
    </Suspense>
  );
}
