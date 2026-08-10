'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  /** Texto complementar exibido abaixo do título. */
  description?: string;
  /** Sobrescreve o tempo de auto-dismiss (ms). `null` mantém o toast até o usuário fechar. */
  duration?: number | null;
}

interface ToastItem extends ToastOptions {
  id: number;
  variant: ToastVariant;
  title: string;
}

interface ToastApi {
  success: (title: string, options?: ToastOptions) => void;
  error: (title: string, options?: ToastOptions) => void;
  warning: (title: string, options?: ToastOptions) => void;
  info: (title: string, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Erros exigem fechamento manual; os demais somem sozinhos. */
const DEFAULT_DURATION: Record<ToastVariant, number | null> = {
  success: 5000,
  info: 5000,
  warning: 7000,
  error: null,
};

const MAX_VISIBLE = 4;

const VARIANT_STYLE: Record<ToastVariant, { icon: typeof CheckCircle2; accent: string; iconColor: string }> = {
  success: { icon: CheckCircle2, accent: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  error: { icon: XCircle, accent: 'bg-rose-500', iconColor: 'text-rose-500' },
  warning: { icon: AlertTriangle, accent: 'bg-amber-500', iconColor: 'text-amber-500' },
  info: { icon: Info, accent: 'bg-brand', iconColor: 'text-brand' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, title: string, options?: ToastOptions) => {
      const id = nextId.current++;
      const duration = options?.duration !== undefined ? options.duration : DEFAULT_DURATION[variant];

      setToasts((prev) => {
        // Deduplicação: a mesma mensagem disparada duas vezes não empilha.
        const duplicate = prev.find(
          (t) => t.variant === variant && t.title === title && t.description === options?.description,
        );
        if (duplicate) return prev;

        const next = [...prev, { id, variant, title, ...options }];
        // Mantém apenas os mais recentes; os excedentes têm o timer cancelado.
        if (next.length > MAX_VISIBLE) {
          for (const excedente of next.slice(0, next.length - MAX_VISIBLE)) {
            const timer = timers.current.get(excedente.id);
            if (timer) {
              clearTimeout(timer);
              timers.current.delete(excedente.id);
            }
          }
          return next.slice(next.length - MAX_VISIBLE);
        }
        return next;
      });

      if (duration !== null) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, options) => push('success', title, options),
      error: (title, options) => push('error', title, options),
      warning: (title, options) => push('warning', title, options),
      info: (title, options) => push('info', title, options),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-[min(24rem,calc(100vw-3rem))] pointer-events-none"
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const { icon: Icon, accent, iconColor } = VARIANT_STYLE[toast.variant];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                role={toast.variant === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto relative flex gap-3 bg-surface rounded-xl shadow-elevated border border-black/[0.06] p-4 pl-5 overflow-hidden"
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} aria-hidden />

                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} aria-hidden />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink-primary leading-snug">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-1 text-xs text-ink-muted leading-relaxed whitespace-pre-line">
                      {toast.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Fechar notificação"
                  className="shrink-0 h-6 w-6 -mt-1 -mr-1 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink-primary hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>. Verifique src/app/layout.tsx.');
  }
  return context;
}
