'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { Calculator } from 'lucide-react';

export default function ApuracaoPage() {
  return (
    <DepartmentModuleView
      departmentName="Fiscal & Tributário"
      moduleName="Apuração de Impostos"
      subtitle="Cálculo mensal de tributos federais, estaduais e municipais"
      Icon={Calculator}
      themeColor="bg-emerald-600"
      backHref="/departamentos/fiscal"
      newItemLabel="Calcular Período"
      items={[
        { id: '1', codigo: 'APUR-2026-07', titulo: 'Apuração Simples Nacional Julho/2026', subtitulo: 'Faturamento Bruto R$ 310.500,00 • Anexo III', valor: 'R$ 24.120,00', data: 'Apurado: 31/07', status: 'Pronto p/ Emissão', statusClass: 'bg-blue-100 text-blue-800' },
        { id: '2', codigo: 'APUR-2026-06', titulo: 'Apuração Simples Nacional Junho/2026', subtitulo: 'Faturamento Bruto R$ 295.000,00 • Anexo III', valor: 'R$ 22.800,00', data: 'Pago: 20/07', status: 'Quitado', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '3', codigo: 'APUR-2026-05', titulo: 'Apuração Simples Nacional Maio/2026', subtitulo: 'Faturamento Bruto R$ 280.000,00 • Anexo III', valor: 'R$ 21.500,00', data: 'Pago: 20/06', status: 'Quitado', statusClass: 'bg-emerald-100 text-emerald-800' },
      ]}
    />
  );
}
