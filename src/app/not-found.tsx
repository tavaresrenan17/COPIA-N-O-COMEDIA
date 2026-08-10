import Link from 'next/link';
import { Compass, Home, LayoutGrid } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-lg bg-surface rounded-2xl p-8 shadow-soft border border-black/[0.03] text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-light text-brand flex items-center justify-center mx-auto">
          <Compass className="w-7 h-7" aria-hidden />
        </div>

        <h1 className="mt-5 text-xl font-bold text-ink-primary">Página não encontrada</h1>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          O endereço acessado não existe ou foi movido. Use o menu lateral para chegar ao módulo
          desejado.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 transition-colors"
          >
            <Home className="w-4 h-4" aria-hidden />
            Ir para o início
          </Link>
          <Link
            href="/departamentos"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold text-ink-muted hover:text-ink-primary hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand transition-colors"
          >
            <LayoutGrid className="w-4 h-4" aria-hidden />
            Ver departamentos
          </Link>
        </div>
      </div>
    </div>
  );
}
