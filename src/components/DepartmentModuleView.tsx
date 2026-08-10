'use client';

import Link from 'next/link';
import { ArrowLeft, Plus, Search, Filter, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ModuleItem {
  id: string;
  codigo: string;
  titulo: string;
  subtitulo: string;
  status: string;
  statusClass: string;
  valor?: string;
  data: string;
}

interface DepartmentModuleViewProps {
  departmentName: string;
  moduleName: string;
  subtitle: string;
  Icon: LucideIcon;
  themeColor: string;
  backHref: string;
  items: ModuleItem[];
  newItemLabel?: string;
}

export function DepartmentModuleView({
  departmentName,
  moduleName,
  subtitle,
  Icon,
  themeColor,
  backHref,
  items,
  newItemLabel,
}: DepartmentModuleViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card">
        <div className="flex items-center gap-4">
          <Link
            href={backHref}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
            title="Voltar para a Visão Geral do Departamento"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {departmentName}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
              <span className={`w-8 h-8 rounded-lg ${themeColor} text-white flex items-center justify-center shadow-xs`}>
                <Icon className="w-4 h-4" />
              </span>
              <span>{moduleName}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {newItemLabel && (
          <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${themeColor} text-white font-semibold text-xs shadow-md hover:opacity-95 transition-all active:scale-95`}>
            <Plus className="w-4 h-4" />
            <span>{newItemLabel}</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Buscar em ${moduleName}...`}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition-colors">
            <Filter className="w-4 h-4 text-slate-500" />
            <span>Filtrar</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition-colors">
            <Download className="w-4 h-4 text-slate-500" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Código / Ref.</th>
                <th className="py-3.5 px-5">Descrição / Título</th>
                <th className="py-3.5 px-5">Detalhes</th>
                <th className="py-3.5 px-5">Data</th>
                {items.some((i) => i.valor) && <th className="py-3.5 px-5 text-right">Valor</th>}
                <th className="py-3.5 px-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-5 font-mono font-bold text-slate-600">
                    {item.codigo}
                  </td>
                  <td className="py-3.5 px-5 font-bold text-slate-800">
                    {item.titulo}
                  </td>
                  <td className="py-3.5 px-5 text-slate-500">
                    {item.subtitulo}
                  </td>
                  <td className="py-3.5 px-5 text-slate-500">
                    {item.data}
                  </td>
                  {items.some((i) => i.valor) && (
                    <td className="py-3.5 px-5 text-right font-bold text-slate-800">
                      {item.valor || '—'}
                    </td>
                  )}
                  <td className="py-3.5 px-5 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${item.statusClass}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
