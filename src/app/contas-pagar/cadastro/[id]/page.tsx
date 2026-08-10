'use client';

import { use } from 'react';
import { CadastroTituloPage } from '@/components/CadastroTituloPage';

export default function EditarContaPagarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CadastroTituloPage tipo="P" tituloId={id} />;
}
