'use client';

import Link from 'next/link';
import { HubHeader } from '@/components/HubPage';
import { Building2, ArrowRight } from 'lucide-react';
import { DEPARTMENTS, type DepartmentConfig } from '@/data/departments';

/**
 * Hub de departamentos.
 *
 * Dos departamentos visíveis, hoje só o Financeiro está ligado — os outros
 * quatro são `inativo: true`. A versão anterior dava a TODOS o mesmo cartão
 * completo (ícone, selo, título, subtítulo, descrição, caixa "Principais
 * Recursos" com chips e botão grande), então quatro quintos da tela eram peso
 * visual levando a lugar nenhum.
 *
 * Agora a tela separa o que dá para usar do que ainda vai existir: os ativos
 * ganham cartão, os inativos viram uma lista compacta. O roadmap continua à
 * vista, sem competir com o que funciona.
 */
export default function DepartamentosPage() {
  const visiveis = Object.values(DEPARTMENTS)
    // `ocultoNoHub` tira daqui as áreas que já têm entrada na sidebar global.
    // Elas seguem acessíveis pelo seletor de ambiente.
    .filter((dept) => !dept.ocultoNoHub)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const ativos = visiveis.filter((dept) => !dept.inativo);
  const emBreve = visiveis.filter((dept) => dept.inativo);

  return (
    <div>
      <HubHeader
        title="Departamentos"
        subtitle="Escolha um ambiente de trabalho — cada um traz menu e indicadores próprios"
        Icon={Building2}
      />

      {ativos.length > 0 && (
        <section>
          <SecaoTitulo>Disponível agora</SecaoTitulo>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ativos.map((dept) => (
              <CardAtivo key={dept.id} dept={dept} />
            ))}
          </div>
        </section>
      )}

      {emBreve.length > 0 && (
        <section className="mt-8">
          <SecaoTitulo>Em breve</SecaoTitulo>
          <ul className="overflow-hidden rounded-2xl border border-black/[0.03] bg-surface shadow-soft divide-y divide-black/[0.04]">
            {emBreve.map((dept) => (
              <LinhaEmBreve key={dept.id} dept={dept} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
      {children}
    </h2>
  );
}

/**
 * O cartão inteiro é o link. Antes o alvo clicável era só o botão "Entrar no
 * Ambiente" no rodapé, o que obrigava a mirar numa faixa estreita de um cartão
 * que já parecia clicável por inteiro.
 */
function CardAtivo({ dept }: { dept: DepartmentConfig }) {
  const Icon = dept.Icon;

  return (
    <Link
      href={dept.baseHref}
      className="group flex flex-col rounded-2xl border border-black/[0.03] bg-surface p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-elevated active:scale-[0.99]"
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${dept.themeColor} text-white`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
          {dept.modules.length} módulos
        </span>
      </div>

      <div className="mt-4 flex-1">
        <p className="text-base font-bold text-ink-primary transition-colors group-hover:text-brand">
          {dept.name}
        </p>
        {/* Só a descrição: o `subtitle` repetia a mesma ideia em outras palavras
            ("Gestão Financeira & Caixa" acima de "Contas a pagar e receber..."). */}
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{dept.description}</p>
      </div>

      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
        Entrar no ambiente
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function LinhaEmBreve({ dept }: { dept: DepartmentConfig }) {
  const Icon = dept.Icon;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-primary/70">{dept.name}</p>
        <p className="truncate text-xs text-ink-muted">{dept.description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        Em breve
      </span>
    </li>
  );
}
