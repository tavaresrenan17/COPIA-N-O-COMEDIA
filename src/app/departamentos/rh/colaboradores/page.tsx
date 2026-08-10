'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { UserCheck } from 'lucide-react';

export default function ColaboradoresPage() {
  return (
    <DepartmentModuleView
      departmentName="Recursos Humanos"
      moduleName="Quadro de Colaboradores"
      subtitle="Lista completa de funcionários ativos e histórico de admissões"
      Icon={UserCheck}
      themeColor="bg-blue-600"
      backHref="/departamentos/rh"
      newItemLabel="Novo Colaborador"
      items={[
        { id: '1', codigo: 'COL-001', titulo: 'Carlos Eduardo Silva', subtitulo: 'Engenheiro Civil • CLT', data: 'Admissão: 10/01/2022', status: 'Ativo', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '2', codigo: 'COL-002', titulo: 'Mariana Costa', subtitulo: 'Analista Financeiro • CLT', data: 'Admissão: 15/03/2023', status: 'Férias', statusClass: 'bg-amber-100 text-amber-800' },
        { id: '3', codigo: 'COL-003', titulo: 'Fernanda Oliveira', subtitulo: 'Coordenadora de Vendas • CLT', data: 'Admissão: 02/05/2021', status: 'Ativo', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '4', codigo: 'COL-004', titulo: 'Roberto Mendes', subtitulo: 'Mestre de Obras • CLT', data: 'Admissão: 11/08/2020', status: 'Ativo', statusClass: 'bg-emerald-100 text-emerald-800' },
      ]}
    />
  );
}
