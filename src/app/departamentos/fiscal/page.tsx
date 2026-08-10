'use client';

import { DEPARTMENTS } from '@/data/departments';
import { SetorInativoPage } from '@/components/SetorInativoPage';

export default function FiscalPage() {
  const dept = DEPARTMENTS.fiscal;

  return (
    <SetorInativoPage
      nome={dept.name}
      subtitulo={dept.subtitle}
      description={dept.description}
      Icon={dept.Icon}
      themeColor={dept.themeColor}
    />
  );
}
