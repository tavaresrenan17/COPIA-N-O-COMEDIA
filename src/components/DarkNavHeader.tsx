'use client';

import { useState } from 'react';
import { FileCheck, Receipt, Globe, Search } from 'lucide-react';

interface DarkNavHeaderProps {
  onSearchChange?: (term: string) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function DarkNavHeader({ onSearchChange, activeTab = 'consulta', onTabChange }: DarkNavHeaderProps) {
  const [currentTab, setCurrentTab] = useState(activeTab);

  const tabs = [
    { id: 'dav', label: 'DAV- Documento Auxiliar de Venda', icon: FileCheck },
    { id: 'faturar', label: 'Faturar DAV', icon: Receipt },
    { id: 'ecommerce', label: 'E-Commerce', icon: Globe },
    { id: 'consulta', label: 'Consulta de Situação', icon: Search },
  ];

  const handleSelect = (id: string) => {
    setCurrentTab(id);
    if (onTabChange) onTabChange(id);
  };

  return (
    <div className="w-full bg-sidebar-bg rounded-2xl p-2.5 flex items-center justify-between text-white mb-6 shadow-elevated overflow-x-auto">
      <div className="flex items-center gap-2 w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/20'
                  : 'text-sidebar-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? 'text-brand' : 'text-sidebar-muted'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
