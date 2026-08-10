'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { Receipt } from 'lucide-react';

export default function GuiasPage() {
  return (
    <DepartmentModuleView
      departmentName="Fiscal & Tributário"
      moduleName="Guias de Recolhimento"
      subtitle="DAS, DARF, GARE, ISS e Guias de Impostos Retidos na Fonte"
      Icon={Receipt}
      themeColor="bg-emerald-600"
      backHref="/departamentos/fiscal"
      newItemLabel="Gerar Guia DARF/DAS"
      items={[
        { id: '1', codigo: 'GUIA-DAS-07', titulo: 'Documento de Arrecadação do Simples (DAS)', subtitulo: 'Competência: 07/2026 • Código Receita 2001', valor: 'R$ 18.240,00', data: 'Venc: 20/08/2026', status: 'A Pagar', statusClass: 'bg-amber-100 text-amber-800' },
        { id: '2', codigo: 'GUIA-ISS-07', titulo: 'Guia de ISSQN Retido na Fonte', subtitulo: 'Prefeitura Municipal • Tomador de Serviços', valor: 'R$ 5.880,00', data: 'Venc: 10/08/2026', status: 'A Pagar', statusClass: 'bg-amber-100 text-amber-800' },
        { id: '3', codigo: 'GUIA-DARF-06', titulo: 'DARF IRRF sobre Folha de Pagamento', subtitulo: 'Competência: 06/2026 • Cod. 0561', valor: 'R$ 6.450,00', data: 'Pago: 20/07/2026', status: 'Pago', statusClass: 'bg-emerald-100 text-emerald-800' },
      ]}
    />
  );
}
