'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { FileSpreadsheet } from 'lucide-react';

export default function NotasPage() {
  return (
    <DepartmentModuleView
      departmentName="Fiscal & Tributário"
      moduleName="Notas Fiscais (NF-e / NFS-e)"
      subtitle="Emissão, cancelamento, inutilização e consulta de XMLs"
      Icon={FileSpreadsheet}
      themeColor="bg-emerald-600"
      backHref="/departamentos/fiscal"
      newItemLabel="Emitir Nova NF-e"
      items={[
        { id: '1', codigo: 'NFE-00892', titulo: 'NF-e Construtora Alfa Ltda', subtitulo: 'Prestação de Serviço de Engenharia', valor: 'R$ 48.500,00', data: 'Emitida: Hoje 10:14', status: 'Autorizada SEFAZ', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '2', codigo: 'NFE-00891', titulo: 'NF-e Engenharia Beta S/A', subtitulo: 'Locação de Equipamentos de Obra', valor: 'R$ 32.000,00', data: 'Emitida: Ontem 16:45', status: 'Autorizada SEFAZ', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '3', codigo: 'NFE-00890', titulo: 'NF-e Incorporadora Cidade Ltda', subtitulo: 'Consultoria de Projetos', valor: 'R$ 15.800,00', data: 'Emitida: 28/07/2026', status: 'Autorizada SEFAZ', statusClass: 'bg-emerald-100 text-emerald-800' },
      ]}
    />
  );
}
