'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { Calendar } from 'lucide-react';

export default function FeriasPage() {
  return (
    <DepartmentModuleView
      departmentName="Recursos Humanos"
      moduleName="Férias & Registro de Ponto"
      subtitle="Escala de férias, banco de horas e controle diário de ponto"
      Icon={Calendar}
      themeColor="bg-blue-600"
      backHref="/departamentos/rh"
      newItemLabel="Agendar Férias"
      items={[
        { id: '1', codigo: 'FER-042', titulo: 'Carlos Eduardo Silva', subtitulo: 'Período Aquisitivo 2024/2025 • 15 dias', data: '01/08 a 15/08', status: 'Em Gozo', statusClass: 'bg-amber-100 text-amber-800' },
        { id: '2', codigo: 'FER-043', titulo: 'Mariana Costa', subtitulo: 'Período Aquisitivo 2024/2025 • 30 dias', data: '15/08 a 14/09', status: 'Aprovado', statusClass: 'bg-blue-100 text-blue-800' },
        { id: '3', codigo: 'FER-044', titulo: 'Fernanda Oliveira', subtitulo: 'Período Aquisitivo 2025/2026 • 20 dias', data: '01/10 a 20/10', status: 'Solicitado', statusClass: 'bg-slate-100 text-slate-800' },
      ]}
    />
  );
}
