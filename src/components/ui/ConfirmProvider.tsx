'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';

export type ConfirmVariant = 'danger' | 'warning' | 'default';

export interface ConfirmOptions {
  title: string;
  /** Explica a consequência da ação em uma frase. */
  description?: string;
  /** Bloco livre com os dados do registro afetado ou o impacto da operação. */
  detail?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const VARIANT_STYLE: Record<
  ConfirmVariant,
  { icon: typeof AlertTriangle; iconWrap: string; confirmButton: string }
> = {
  danger: {
    icon: Trash2,
    iconWrap: 'bg-rose-50 text-rose-500',
    confirmButton: 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-500',
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-amber-50 text-amber-500',
    confirmButton: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500',
  },
  default: {
    icon: HelpCircle,
    iconWrap: 'bg-brand-light text-brand',
    confirmButton: 'bg-brand hover:bg-brand-hover focus:ring-brand',
  },
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    // Uma nova chamada com um diálogo já aberto resolve o anterior como cancelado.
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const variant = options?.variant ?? 'default';
  const { icon: Icon, iconWrap, confirmButton } = VARIANT_STYLE[variant];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <Modal
        isOpen={options !== null}
        onClose={() => settle(false)}
        title={options?.title ?? ''}
        description={options?.description}
        size="sm"
        icon={
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconWrap}`}>
            <Icon className="w-5 h-5" aria-hidden />
          </span>
        }
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => settle(false)}
              className="px-4 py-2 rounded-[10px] text-sm font-semibold text-ink-muted hover:text-ink-primary hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
            >
              {options?.cancelLabel ?? 'Cancelar'}
            </button>
            <button
              type="button"
              onClick={() => settle(true)}
              className={`px-4 py-2 rounded-[10px] text-sm font-bold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${confirmButton}`}
            >
              {options?.confirmLabel ?? 'Confirmar'}
            </button>
          </div>
        }
      >
        {options?.detail ? (
          <div className="text-sm text-ink-primary">{options.detail}</div>
        ) : (
          <p className="text-sm text-ink-muted">Esta ação precisa da sua confirmação para continuar.</p>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

/**
 * Substitui o `confirm()` nativo mantendo o mesmo formato de chamada:
 * `if (await confirm({ ... })) { ... }`
 */
export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>. Verifique src/app/layout.tsx.');
  }
  return context;
}
