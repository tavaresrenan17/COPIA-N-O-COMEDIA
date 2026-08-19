'use client';

import { HubHeader, HubCard } from '@/components/HubPage';
import { BarChart3, TrendingUp } from 'lucide-react';

export default function RelatoriosPage() {
  return (
    <div>
      <HubHeader
        title="Relatórios"
        subtitle="Indicadores — visões consolidadas para tomada de decisão"
        Icon={BarChart3}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard
          href="/relatorios/executivo"
          title="Dashboard Executivo"
          description="Resultado do período, despesas por plano financeiro e centros de custo"
          Icon={BarChart3}
        />
        <HubCard
          href="/orcamentos/acompanhamento"
          title="Acompanhamento Orçamentário"
          description="Orçado × realizado por obra e período"
          Icon={TrendingUp}
          iconClass="text-emerald-500"
        />
      </div>
    </div>
  );
}
