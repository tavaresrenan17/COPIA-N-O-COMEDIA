'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/** Elementos que podem receber foco dentro do painel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openModalCount = 0;

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Linha de apoio abaixo do título. */
  description?: string;
  /** Ícone exibido à esquerda do título. */
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Barra de ações fixa no rodapé. */
  footer?: React.ReactNode;
  /** Largura máxima do painel. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /**
   * Quando `false`, ESC e clique no backdrop não fecham o modal.
   * Use em formulários com alterações não salvas, delegando o fechamento a uma confirmação.
   */
  dismissible?: boolean;
  /** Chamado quando o usuário tenta fechar com `dismissible={false}` (ESC ou backdrop). */
  onDismissAttempt?: () => void;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  dismissible = true,
  onDismissAttempt,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const requestClose = useCallback(() => {
    if (dismissible) {
      onClose();
    } else {
      onDismissAttempt?.();
    }
  }, [dismissible, onClose, onDismissAttempt]);

  // Trava o scroll do body enquanto houver ao menos um modal aberto.
  useEffect(() => {
    if (!isOpen) return;

    openModalCount += 1;
    const { overflow, paddingRight } = document.body.style;
    if (openModalCount === 1) {
      // Compensa a barra de rolagem para o conteúdo não "pular" ao travar.
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    }

    return () => {
      openModalCount -= 1;
      if (openModalCount === 0) {
        document.body.style.overflow = overflow;
        document.body.style.paddingRight = paddingRight;
      }
    };
  }, [isOpen]);

  // Guarda o gatilho, move o foco para dentro do painel e devolve o foco ao fechar.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const focusFirst = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panel).focus();
    });

    return () => {
      cancelAnimationFrame(focusFirst);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // ESC fecha e Tab circula dentro do painel.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        requestClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, requestClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(event) => {
            // Só fecha se o gesto começou no backdrop (evita fechar ao arrastar seleção de texto).
            if (event.target === event.currentTarget) requestClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            key="panel"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onMouseDown={(event) => event.stopPropagation()}
            className={`w-full ${SIZE_CLASS[size]} max-h-[92vh] flex flex-col bg-surface rounded-2xl shadow-elevated border border-black/[0.04] focus:outline-none`}
          >
            <header className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-black/[0.06]">
              {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
              <div className="flex-1 min-w-0">
                <h2 id={titleId} className="text-lg font-bold text-ink-primary leading-snug">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="mt-1 text-sm text-ink-muted leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Fechar"
                className="shrink-0 h-8 w-8 -mt-1 -mr-1 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink-primary hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

            {footer && (
              <footer className="px-6 py-4 border-t border-black/[0.06] bg-surface-muted/60 rounded-b-2xl">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
