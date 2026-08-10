'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useConfirm } from '@/components/ui/ConfirmProvider';

interface UseUnsavedChangesOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Protege formulários com alterações pendentes.
 *
 * - Fechar a aba / recarregar dispara o aviso nativo do navegador (`beforeunload`).
 *   O texto é definido pelo browser e não pode ser customizado.
 * - Navegação interna e fechamento de modal usam `guard(acao)`, que só executa
 *   a ação depois de o usuário confirmar o descarte.
 *
 * @param isDirty `true` quando há alterações não salvas.
 */
export function useUnsavedChanges(isDirty: boolean, options: UseUnsavedChangesOptions = {}) {
  const confirm = useConfirm();
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Navegadores modernos ignoram a mensagem, mas `returnValue` ainda é
      // necessário para que o diálogo apareça.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  /**
   * Executa `action` diretamente quando não há alterações pendentes;
   * caso contrário pede confirmação antes. Retorna `true` se a ação rodou.
   */
  const guard = useCallback(
    async (action: () => void): Promise<boolean> => {
      if (!dirtyRef.current) {
        action();
        return true;
      }

      const descartar = await confirm({
        title: options.title ?? 'Descartar alterações?',
        description:
          options.description ??
          'Você preencheu campos que ainda não foram salvos. Se sair agora, essas informações serão perdidas.',
        confirmLabel: options.confirmLabel ?? 'Descartar e sair',
        cancelLabel: options.cancelLabel ?? 'Continuar editando',
        variant: 'warning',
      });

      if (descartar) action();
      return descartar;
    },
    [confirm, options.title, options.description, options.confirmLabel, options.cancelLabel],
  );

  return { guard };
}
