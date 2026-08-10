'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { FileCheck2 } from 'lucide-react';

export default function ContratosPage() {
  return (
    <DepartmentModuleView
      departmentName="Jurídico"
      moduleName="Gestão de Contratos"
      subtitle="Contratos de prestação de serviços, locação, fornecedores e aditivos"
      Icon={FileCheck2}
      themeColor="bg-amber-600"
      backHref="/departamentos/juridico"
      newItemLabel="Novo Contrato"
      items={[
        { id: '1', codigo: 'CT-2024-042', titulo: 'Prestação de Serviços de TI', subtitulo: 'Contratada: TechSolutions Brasil Ltda', valor: 'R$ 15.000,00/mês', data: 'Venc: 15/08/2026', status: 'A Renovar', statusClass: 'bg-amber-100 text-amber-800' },
        { id: '2', codigo: 'CT-2023-018', titulo: 'Locação Comercial Sede Matriz', subtitulo: 'Locador: Imobiliária Central S/A', valor: 'R$ 22.000,00/mês', data: 'Venc: 30/09/2026', status: 'Vigente', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '3', codigo: 'CT-2024-009', titulo: 'Fornecimento de Cimento e Concreto', subtitulo: 'Fornecedor: Concremax S/A', valor: 'R$ 180.000,00 total', data: 'Venc: 10/12/2026', status: 'Vigente', statusClass: 'bg-emerald-100 text-emerald-800' },
      ]}
    />
  );
}
