'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { DollarSign } from 'lucide-react';

export default function FolhaPage() {
  return (
    <DepartmentModuleView
      departmentName="Recursos Humanos"
      moduleName="Folha de Pagamento"
      subtitle="Holerites, proventos, descontos e tributos da folha mensal"
      Icon={DollarSign}
      themeColor="bg-blue-600"
      backHref="/departamentos/rh"
      newItemLabel="Processar Folha"
      items={[
        { id: '1', codigo: 'FOL-2026-07', titulo: 'Folha de Pagamento Julho/2026', subtitulo: '42 Colaboradores • INSS + FGTS', valor: 'R$ 185.000,00', data: 'Venc: 05/08/2026', status: 'Fechada', statusClass: 'bg-blue-100 text-blue-800' },
        { id: '2', codigo: 'FOL-2026-06', titulo: 'Folha de Pagamento Junho/2026', subtitulo: '41 Colaboradores • Pago', valor: 'R$ 181.200,00', data: 'Pago: 05/07/2026', status: 'Pago', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '3', codigo: 'FOL-2026-05', titulo: 'Folha de Pagamento Maio/2026', subtitulo: '40 Colaboradores • Pago', valor: 'R$ 178.500,00', data: 'Pago: 05/06/2026', status: 'Pago', statusClass: 'bg-emerald-100 text-emerald-800' },
      ]}
    />
  );
}
