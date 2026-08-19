'use client';

import { useEffect } from 'react';
import { ToastProvider, useToast } from './ToastProvider';
import { ConfirmProvider } from './ConfirmProvider';
import { AuthProvider } from '@/context/AuthContext';
import { SidebarProvider } from '@/context/SidebarContext';

const STORAGE_KEY = 'melhor-gestao.erp.state';

/**
 * Avisa quando outra aba altera os dados.
 *
 * Não re-hidratamos automaticamente: o estado React das telas abertas ficaria
 * dessincronizado do módulo de dados, o que é pior que o aviso.
 */
function MultiTabWatcher() {
  const toast = useToast();

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || event.newValue === null) return;
      toast.warning('Os dados foram alterados em outra aba', {
        description: 'Recarregue a página (F5) para ver a versão mais recente.',
        duration: null,
      });
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [toast]);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <ToastProvider>
          <ConfirmProvider>
            <MultiTabWatcher />
            {children}
          </ConfirmProvider>
        </ToastProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}
