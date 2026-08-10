'use client';

import { DEPARTMENTS } from '@/data/departments';
import { SetorInativoPage } from '@/components/SetorInativoPage';

export default function ComercialPage() {
  const dept = DEPARTMENTS.comercial;

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
