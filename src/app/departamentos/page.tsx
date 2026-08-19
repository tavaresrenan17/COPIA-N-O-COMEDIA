'use client';

import Link from 'next/link';
import { HubHeader } from '@/components/HubPage';
import { Building2, ArrowRight, Layers } from 'lucide-react';
import { DEPARTMENTS } from '@/data/departments';

export default function DepartamentosPage() {
  return (
    <div className="space-y-6">
      <HubHeader
        title="Departamentos da Empresa"
        subtitle="Selecione um departamento para entrar no seu ambiente de trabalho com menu dinâmico e indicadores específicos."
        Icon={Building2}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* `ocultoNoHub` tira daqui as áreas que já têm entrada na sidebar global.
            Elas seguem acessíveis pelo seletor de ambiente. */}
        {Object.values(DEPARTMENTS)
          .filter((dept) => !dept.ocultoNoHub)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          .map((dept) => {
          const Icon = dept.Icon;
          const isInativo = dept.inativo;

          return (
            <div
              key={dept.id}
              className={`bg-white rounded-2xl p-6 border shadow-card transition-all duration-300 flex flex-col justify-between group ${
                isInativo
                  ? 'border-slate-200 opacity-75 grayscale-[20%]'
                  : 'border-slate-200/80 hover:shadow-xl hover:-translate-y-1'
              }`}
            >
              <div>
                {/* Header Card */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-2xl ${
                      isInativo ? 'bg-slate-400' : dept.themeColor
                    } text-white flex items-center justify-center shadow-lg transition-transform ${
                      !isInativo && 'group-hover:scale-110'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  {isInativo ? (
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                      Em Breve
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {dept.modules.length} Módulos
                    </span>
                  )}
                </div>

                <h3
                  className={`text-xl font-bold tracking-tight mb-1 transition-colors ${
                    isInativo ? 'text-slate-500' : 'text-slate-800 group-hover:text-brand'
                  }`}
                >
                  {dept.name}
                </h3>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  {dept.subtitle}
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  {dept.description}
                </p>
              </div>

              <div>
                {/* Highlights / Modules List */}
                <div className="bg-slate-50/80 rounded-xl p-3 mb-5 space-y-2 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Principais Recursos:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {dept.modules.slice(1, 4).map((mod) => (
                      <span
                        key={mod.href}
                        className="text-xs font-medium bg-white text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs"
                      >
                        {mod.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Enter Button */}
                {isInativo ? (
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-200 text-slate-400 font-semibold text-sm cursor-not-allowed select-none"
                  >
                    <span>Em Desenvolvimento</span>
                  </button>
                ) : (
                  <Link
                    href={dept.baseHref}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl ${dept.themeColor} text-white font-semibold text-sm shadow-md hover:opacity-95 transition-all group-hover:shadow-lg`}
                  >
                    <span>Entrar no Ambiente</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
