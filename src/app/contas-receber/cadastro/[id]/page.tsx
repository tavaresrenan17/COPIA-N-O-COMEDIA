'use client';

import { use } from 'react';
import { CadastroTituloPage } from '@/components/CadastroTituloPage';

export default function EditarContaReceberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CadastroTituloPage tipo="R" tituloId={id} />;
}
