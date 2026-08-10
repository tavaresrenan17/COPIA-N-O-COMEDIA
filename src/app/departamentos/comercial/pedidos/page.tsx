'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { TrendingUp } from 'lucide-react';

export default function PedidosPage() {
  return (
    <DepartmentModuleView
      departmentName="Comercial & Vendas"
      moduleName="Pedidos de Venda"
      subtitle="Faturamento, entregas e acompanhamento de pedidos comerciais"
      Icon={TrendingUp}
      themeColor="bg-rose-600"
      backHref="/departamentos/comercial"
      newItemLabel="Novo Pedido"
      items={[
        { id: '1', codigo: 'PV-00104', titulo: 'Pedido de Venda Construtora Alfa', subtitulo: 'Origem: DAV-0042 • Entregas parciais', valor: 'R$ 48.500,00', data: 'Data: 28/07/2026', status: 'Em Expedição', statusClass: 'bg-blue-100 text-blue-800' },
        { id: '2', codigo: 'PV-00103', titulo: 'Pedido de Venda Engenharia Beta', subtitulo: 'Origem: DAV-0043 • Faturado total', valor: 'R$ 32.000,00', data: 'Data: 25/07/2026', status: 'Entregue', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '3', codigo: 'PV-00102', titulo: 'Pedido de Venda Incorporadora Cidade', subtitulo: 'Origem: DAV-0039 • Concluído', valor: 'R$ 15.800,00', data: 'Data: 20/07/2026', status: 'Concluído', statusClass: 'bg-emerald-100 text-emerald-800' },
      ]}
    />
  );
}
