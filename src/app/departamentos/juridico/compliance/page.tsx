'use client';

import { DepartmentModuleView } from '@/components/DepartmentModuleView';
import { ShieldCheck } from 'lucide-react';

export default function CompliancePage() {
  return (
    <DepartmentModuleView
      departmentName="Jurídico"
      moduleName="Compliance & Certidões CND"
      subtitle="Validade de certidões negativas, regularidade fiscal e governança"
      Icon={ShieldCheck}
      themeColor="bg-amber-600"
      backHref="/departamentos/juridico"
      newItemLabel="Nova Certidão"
      items={[
        { id: '1', codigo: 'CND-RFB', titulo: 'Certidão Negativa Receita Federal & PGFN', subtitulo: 'Tributos Federais e Dívida Ativa da União', data: 'Vence em: 15/10/2026', status: 'Válida (Regular)', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '2', codigo: 'CND-FGTS', titulo: 'Certificado de Regularidade do FGTS (CRF)', subtitulo: 'Caixa Econômica Federal', data: 'Vence em: 28/08/2026', status: 'Válida (Regular)', statusClass: 'bg-emerald-100 text-emerald-800' },
        { id: '3', codigo: 'CND-CNDT', titulo: 'Certidão Negativa de Débitos Trabalhistas', subtitulo: 'Justiça do Trabalho', data: 'Vence em: 10/12/2026', status: 'Válida (Regular)', statusClass: 'bg-emerald-100 text-emerald-800' },
      ]}
    />
  );
}
