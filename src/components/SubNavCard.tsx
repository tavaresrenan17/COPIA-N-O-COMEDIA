'use client';

import { useState } from 'react';
import { CheckCircle2, FileText, Truck, Package, ArrowDownToLine } from 'lucide-react';

interface SubNavCardProps {
  onSelectOption?: (optionId: string) => void;
}

export function SubNavCard({ onSelectOption }: SubNavCardProps) {
  const [activeId, setActiveId] = useState('status');

  const options = [
    { id: 'status', title: 'Status', subtitle: 'Consulta de Situação', icon: CheckCircle2 },
    { id: 'faturamento', title: 'Faturamento', subtitle: 'Emissão de Notas Fiscais', icon: FileText },
    { id: 'expedicao', title: 'Expedição', subtitle: 'Status do Carregamento', icon: Truck },
    { id: 'entrega', title: 'Entrega', subtitle: 'Confirmação Entrega', icon: Package },
    { id: 'recebimento', title: 'Recebimento', subtitle: 'Baixa de Pedidos', icon: ArrowDownToLine },
  ];

  const handleSelect = (id: string) => {
    setActiveId(id);
    if (onSelectOption) onSelectOption(id);
  };

  return (
    <div className="w-72 bg-surface rounded-2xl p-6 shadow-soft shrink-0 border border-black/[0.03]">
      <h3 className="text-base font-bold text-ink-primary mb-6 tracking-tight">
        Movimentação
      </h3>

      <div className="space-y-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = activeId === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all relative text-left group ${
                isActive
                  ? 'bg-brand-light text-ink-primary shadow-sm'
                  : 'hover:bg-surface-muted text-ink-primary'
              }`}
            >
              {/* Active right bar indicator */}
              {isActive && (
                <div className="absolute right-0 top-3 bottom-3 w-1 bg-ink-primary rounded-l-full"></div>
              )}

              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-ink-primary text-white'
                    : 'bg-surface-muted text-ink-muted group-hover:text-ink-primary'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-xs font-bold text-ink-primary truncate leading-tight">
                  {opt.title}
                </span>
                <span className="text-[11px] text-ink-muted truncate mt-0.5 leading-tight">
                  {opt.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
