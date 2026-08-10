'use client';

import Link from 'next/link';
import { ArrowLeft, PowerOff } from 'lucide-react';

/**
 * Tela dos módulos desligados (Fluxo de Caixa, Recorrências e Orçamentos).
 *
 * A rota continua existindo — só o conteúdo é substituído. Reativar é remover
 * `inativo: true` do módulo em `src/data/departments.ts` e apagar o wrapper no
 * `page.tsx` correspondente. Nenhum código do módulo foi excluído.
 */
export function ModuloDesativado({ nome, motivo }: { nome: string; motivo?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center pt-6">
      <div className="max-w-md rounded-2xl border border-black/[0.04] bg-surface p-8 text-center shadow-soft">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <PowerOff className="h-7 w-7" />
        </span>

        <h1 className="text-lg font-bold tracking-tight text-ink-primary">{nome} está desativado</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {motivo ?? 'Este módulo não está em uso no momento e foi desligado da navegação.'}
        </p>

        <Link
          href="/departamentos/financeiro"
          className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-brand-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Financeiro
        </Link>
      </div>
    </div>
  );
}
