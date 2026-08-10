'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { Tag } from 'lucide-react';

export default function TabelaPrecosPage() {
  return (
    <DepartmentModuleView
      departmentName="Comercial & Vendas"
      moduleName="Tabela de Preços & Serviços"
      subtitle="Catálogo comercial de serviços, insumos e margens de venda"
      Icon={Tag}
      themeColor="bg-rose-600"
      backHref="/departamentos/comercial"
      newItemLabel="Novo Item na Tabela"
      items={[
        { id: '1', codigo: 'ITEM-001', titulo: 'Serviço de Engenharia de Estruturas', subtitulo: 'Unidade: Hora Técnica • Margem 35%', valor: 'R$ 250,00/h', data: 'Rev: 01/07/2026', status: 'Ativo', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '2', codigo: 'ITEM-002', titulo: 'Locação de Andaime Fachadeiro (Mês)', subtitulo: 'Unidade: Mês • Margem 40%', valor: 'R$ 1.850,00/mês', data: 'Rev: 01/07/2026', status: 'Ativo', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '3', codigo: 'ITEM-003', titulo: 'Consultoria de Licenciamento Ambiental', subtitulo: 'Unidade: Projeto • Margem 30%', valor: 'R$ 12.000,00/proj', data: 'Rev: 01/06/2026', status: 'Ativo', statusClass: 'bg-emerald-100 text-emerald-800' },
      ]}
    />
  );
}
