'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { Gift } from 'lucide-react';

export default function BeneficiosPage() {
  return (
    <DepartmentModuleView
      departmentName="Recursos Humanos"
      moduleName="Gestão de Benefícios"
      subtitle="Vale Transporte, Vale Refeição, Plano de Saúde e Seguros"
      Icon={Gift}
      themeColor="bg-blue-600"
      backHref="/departamentos/rh"
      newItemLabel="Atribuir Benefício"
      items={[
        { id: '1', codigo: 'BEN-001', titulo: 'Vale Alimentação / Refeição (VR/VA)', subtitulo: 'Sodexo Pass • 42 Beneficiários', valor: 'R$ 28.500,00', data: 'Recarga: 01/Ago', status: 'Ativo', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '2', codigo: 'BEN-002', titulo: 'Plano de Saúde Bradesco Saúde', subtitulo: 'Apartamento • 42 Titulares + 18 Dependendentes', valor: 'R$ 38.200,00', data: 'Venc: 10/Ago', status: 'Ativo', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '3', codigo: 'BEN-003', titulo: 'Vale Transporte (Passalbus)', subtitulo: 'Carga de Tarifas • 25 Colaboradores', valor: 'R$ 12.400,00', data: 'Recarga: 01/Ago', status: 'Ativo', statusClass: 'bg-emerald-100 text-emerald-800' },
      ]}
    />
  );
}
