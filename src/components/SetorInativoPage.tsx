'use client';

import React from 'react';
import NextLink from 'next/link';
import { LucideIcon, Wallet, Building2, ArrowLeft, Clock, ShieldAlert } from 'lucide-react';

interface SetorInativoPageProps {
  nome: string;
  subtitulo: string;
  description?: string;
  Icon: LucideIcon;
  themeColor?: string;
}

export function SetorInativoPage({
  nome,
  subtitulo,
  description,
  Icon,
  themeColor = 'bg-slate-700'
}: SetorInativoPageProps) {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8 animate-in fade-in duration-300">
      {/* Top Warning Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden border border-white/10 text-center">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="relative">
            <div className={`w-16 h-16 rounded-2xl ${themeColor} text-white flex items-center justify-center shadow-xl`}>
              <Icon className="w-8 h-8" />
            </div>
            <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow-md">
              <Clock className="w-4 h-4" />
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-widest">
              Setor Inativo — Em Desenvolvimento
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {nome}
            </h1>
            <p className="text-slate-400 text-sm max-w-lg mx-auto font-medium">
              {subtitulo}
            </p>
          </div>

          <p className="text-slate-300 text-xs max-w-xl leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/10">
            {description || 'As funcionalidades deste setor não estão ativas na versão atual do MVP e serão desenvolvidas nas próximas fases do sistema.'}
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <NextLink
              href="/departamentos/financeiro"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-all"
            >
              <Wallet className="w-4 h-4" />
              <span>Ir para o Financeiro</span>
            </NextLink>

            <NextLink
              href="/departamentos"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/15 transition-all"
            >
              <Building2 className="w-4 h-4" />
              <span>Ver Todos os Setores</span>
            </NextLink>
          </div>
        </div>
      </div>
    </div>
  );
}
