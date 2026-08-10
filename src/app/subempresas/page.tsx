'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SubempresasPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/cadastros/grupos-gestao');
  }, [router]);

  return (
    <div className="p-8 text-center text-xs text-ink-muted">
      Redirecionando para Grupos de Gestão...
    </div>
  );
}
