'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[erp] Erro não tratado na renderização:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-lg bg-surface rounded-2xl p-8 shadow-soft border border-black/[0.03] text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
          <AlertOctagon className="w-7 h-7" aria-hidden />
        </div>

        <h1 className="mt-5 text-xl font-bold text-ink-primary">Algo deu errado nesta tela</h1>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          A operação foi interrompida antes de terminar. Nenhum dado foi perdido — você pode tentar
          novamente ou voltar ao início.
        </p>

        {error.message && (
          <p className="mt-4 px-4 py-3 rounded-xl bg-surface-muted text-xs text-ink-muted font-mono break-words text-left">
            {error.message}
            {error.digest && <span className="block mt-1 opacity-60">ref: {error.digest}</span>}
          </p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden />
            Tentar novamente
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold text-ink-muted hover:text-ink-primary hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
          >
            <Home className="w-4 h-4" aria-hidden />
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}
