'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/** Cabeçalho padrão das páginas de navegação (Departamentos, Cadastros, Relatórios). */
export function HubHeader({
  title,
  subtitle,
  Icon,
}: {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="pt-6 mb-6 flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center shadow-md">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-ink-primary tracking-tight">{title}</h1>
        <p className="text-sm text-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}

/** Cartão de acesso a um módulo. Sem `href`, aparece desabilitado com selo "Em breve". */
export function HubCard({
  href,
  title,
  description,
  Icon,
  iconClass = 'text-brand',
}: {
  href?: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  iconClass?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            href ? 'bg-brand/10' : 'bg-black/5'
          }`}
        >
          <Icon className={`w-5 h-5 ${href ? iconClass : 'text-ink-muted/50'}`} />
        </div>
        {!href && (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-black/5 text-ink-muted px-2 py-1 rounded-full">
            Em breve
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className={`text-sm font-bold ${href ? 'text-ink-primary' : 'text-ink-muted/70'}`}>
          {title}
        </p>
        <p className={`text-xs mt-1 ${href ? 'text-ink-muted' : 'text-ink-muted/50'}`}>
          {description}
        </p>
      </div>
    </>
  );

  const base =
    'block bg-surface rounded-2xl p-5 border border-black/[0.03] shadow-soft transition-all';

  if (!href) {
    return <div className={`${base} opacity-80 cursor-not-allowed select-none`}>{inner}</div>;
  }

  return (
    <Link
      href={href}
      className={`${base} hover:shadow-md hover:-translate-y-0.5 hover:border-brand/30 active:scale-[0.99]`}
    >
      {inner}
    </Link>
  );
}
