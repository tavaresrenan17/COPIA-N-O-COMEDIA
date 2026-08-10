'use client';

import { HubHeader, HubCard } from '@/components/HubPage';
import { DEPARTMENTS } from '@/data/departments';

/**
 * Os cards vêm de DEPARTMENTS.cadastros.modules — a mesma lista que a sidebar
 * consulta. Antes estavam escritos à mão aqui, e as duas listas já haviam
 * divergido: "Usuários & Permissões" existia só nesta tela e "Hub de Cadastros"
 * só na sidebar.
 */
export default function CadastrosPage() {
  const dept = DEPARTMENTS.cadastros;

  return (
    <div>
      <HubHeader
        title="Cadastros"
        subtitle="Bases de dados — os registros que alimentam todo o sistema"
        Icon={dept.Icon}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dept.modules.map((mod) => (
          <HubCard
            key={mod.href}
            href={mod.href}
            title={mod.label}
            description={mod.subtitle}
            Icon={mod.Icon}
          />
        ))}
      </div>
    </div>
  );
}
