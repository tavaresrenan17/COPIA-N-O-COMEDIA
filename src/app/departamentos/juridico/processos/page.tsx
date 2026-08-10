'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { Scale } from 'lucide-react';

export default function ProcessosPage() {
  return (
    <DepartmentModuleView
      departmentName="Jurídico"
      moduleName="Processos & Contencioso"
      subtitle="Acompanhamento de processos judiciais, trabalhistas e administrativos"
      Icon={Scale}
      themeColor="bg-amber-600"
      backHref="/departamentos/juridico"
      newItemLabel="Novo Processo"
      items={[
        { id: '1', codigo: 'PROC-00412', titulo: 'Ação Trabalhista ex-colaborador', subtitulo: '2ª Vara do Trabalho • Reclamante: J.S.', valor: 'R$ 35.000,00 estim.', data: 'Audiência: 12/08/2026', status: 'Audiência Agendada', statusClass: 'bg-rose-100 text-rose-800' },
        { id: '2', codigo: 'PROC-00109', titulo: 'Notificação Procon Municipal', subtitulo: 'Defesa Administrativa • Ref: Atraso entrega', valor: 'Sem valor de causa', data: 'Prazo: 18/08/2026', status: 'Em Elaboração', statusClass: 'bg-amber-100 text-amber-800' },
        { id: '3', codigo: 'PROC-00084', titulo: 'Cobrança Judicial Duplicata NFe 104', subtitulo: 'Vara Cível • Réu: Inadimplente X Ltda', valor: 'R$ 48.200,00', data: 'Execução: 05/05/2026', status: 'Em Execução', statusClass: 'bg-blue-100 text-blue-800' },
      ]}
    />
  );
}
