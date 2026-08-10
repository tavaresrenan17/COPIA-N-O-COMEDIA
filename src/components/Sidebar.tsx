'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Building2, ClipboardList, BarChart3, ChevronDown, ArrowLeft, Grid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DEPARTMENTS, DepartmentConfig } from '@/data/departments';

interface MenuItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const ITENS_GLOBAIS: MenuItem[] = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/departamentos', label: 'Departamentos', Icon: Building2 },
  { href: '/cadastros', label: 'Cadastros', Icon: ClipboardList },
  { href: '/relatorios', label: 'Relatórios', Icon: BarChart3 },
];

/** Rótulo de seção — um único estilo para todos os grupos da sidebar. */
function RotuloSecao({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
      {children}
    </p>
  );
}

/**
 * Linha de navegação. Antes existiam três variações (global, módulo e cadastro)
 * com tamanhos de ícone, pesos de fonte e marcações de ativo diferentes — era a
 * maior fonte de ruído visual. Agora é um componente só.
 */
function ItemNav({
  href,
  label,
  Icon,
  ativo,
  inativo,
}: MenuItem & { ativo: boolean; inativo?: boolean }) {
  // Módulo desligado: continua visível para deixar claro que existe, mas não navega.
  if (inativo) {
    return (
      <span
        aria-disabled="true"
        title="Módulo desativado no momento"
        className="flex cursor-not-allowed items-center gap-3 rounded-lg border-l-2 border-transparent py-2 pl-3 pr-2 text-white/25"
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate text-[13px] font-medium">{label}</span>
        <span className="ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wide">
          Off
        </span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={ativo ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-lg border-l-2 py-2 pl-3 pr-2 transition-colors ${
        ativo
          ? 'border-brand bg-white/[0.08] text-white'
          : 'border-transparent text-white/65 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
          ativo ? 'text-brand' : 'text-white/40 group-hover:text-white/70'
        }`}
      />
      <span className="truncate text-[13px] font-medium">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  /* O menu de ambientes não fechava ao clicar fora nem no Esc — ficava aberto
     por cima da navegação. */
  useEffect(() => {
    if (!dropdownOpen) return;

    const aoClicarFora = (e: MouseEvent) => {
      if (!switcherRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };

    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [dropdownOpen]);

  /* Fecha ao navegar. */
  useEffect(() => setDropdownOpen(false), [pathname]);

  const idDepartamentoAtivo = Object.keys(DEPARTMENTS).find((chave) => {
    const dept = DEPARTMENTS[chave];
    if (pathname.startsWith(dept.baseHref)) return true;
    if (dept.modules.some((m) => pathname.startsWith(m.href) && m.href !== '/')) return true;
    if (dept.cadastros.some((c) => pathname.startsWith(c.href) && c.href !== '/')) return true;
    return false;
  });

  const departamentoAtivo: DepartmentConfig | undefined = idDepartamentoAtivo
    ? DEPARTMENTS[idDepartamentoAtivo]
    : undefined;

  const selecionarDepartamento = (deptId: string) => {
    setDropdownOpen(false);
    router.push(deptId === 'global' ? '/departamentos' : DEPARTMENTS[deptId].baseHref);
  };

  return (
    /* h-screen + flex-col: o topo e o rodapé ficam parados e só a navegação
       do meio rola. A sidebar nunca sai da tela junto com o conteúdo. */
    <aside className="z-30 flex h-screen w-64 shrink-0 flex-col select-none border-r border-white/[0.06] bg-sidebar-bg text-sidebar-muted">
      {/* ---------- Topo fixo ---------- */}
      <div className="shrink-0 px-4 pb-4 pt-5">
        <Link href="/" className="mb-5 flex items-center py-1">
          <img
            src="/logo.png"
            alt="MVP Sistema ERP — Delta Plano Bras"
            className="h-11 w-auto max-w-[180px] object-contain transition-opacity hover:opacity-80"
          />
        </Link>

        {/* Seletor de ambiente */}
        <div className="relative" ref={switcherRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-left transition-colors hover:bg-white/[0.07]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${
                  departamentoAtivo ? departamentoAtivo.themeColor : 'bg-brand'
                }`}
              >
                {departamentoAtivo ? (
                  <departamentoAtivo.Icon className="h-3.5 w-3.5" />
                ) : (
                  <Grid className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="truncate text-[13px] font-semibold text-white">
                {departamentoAtivo ? departamentoAtivo.name : 'Visão Geral'}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-full overflow-y-auto rounded-xl border border-white/10 bg-[#1A182D] py-1.5 shadow-2xl"
            >
              <button
                role="menuitem"
                onClick={() => selecionarDepartamento('global')}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-white/[0.07] ${
                  !departamentoAtivo ? 'font-semibold text-brand' : 'text-white/75'
                }`}
              >
                <Grid className="h-4 w-4 shrink-0 text-white/40" />
                <span className="truncate">Visão Geral</span>
              </button>

              <div className="my-1.5 border-t border-white/10" />
              <RotuloSecao>Departamentos</RotuloSecao>

              {Object.values(DEPARTMENTS).map((dept) => {
                const Icon = dept.Icon;
                const selecionado = idDepartamentoAtivo === dept.id;
                return (
                  <button
                    key={dept.id}
                    role="menuitem"
                    disabled={dept.inativo}
                    onClick={() => selecionarDepartamento(dept.id)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                      dept.inativo
                        ? 'cursor-not-allowed text-white/30'
                        : selecionado
                          ? 'bg-white/[0.07] font-semibold text-white'
                          : 'text-white/75 hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-white ${
                          dept.inativo ? 'bg-white/10' : dept.themeColor
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="truncate">{dept.name}</span>
                    </span>
                    {dept.inativo && (
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-white/30">
                        Em breve
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Navegação (rola quando não cabe) ---------- */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        {departamentoAtivo?.navegacaoPorHub ? (
          /* Departamento cuja tela inicial já é um índice completo: repetir a
             lista aqui seria duplicar o que o usuário vê nos cards. Fica só o
             caminho de volta ao hub. */
          <>
            <div>
              <RotuloSecao>{departamentoAtivo.name}</RotuloSecao>
              <ItemNav
                href={departamentoAtivo.baseHref}
                label={departamentoAtivo.hubLabel ?? 'Hub'}
                Icon={departamentoAtivo.Icon}
                ativo={pathname === departamentoAtivo.baseHref}
              />
            </div>

            <Link
              href="/departamentos"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span>Todos os departamentos</span>
            </Link>
          </>
        ) : departamentoAtivo ? (
          <>
            <div>
              <RotuloSecao>Módulos</RotuloSecao>
              <div className="space-y-0.5">
                {departamentoAtivo.modules.map((mod) => (
                  <ItemNav
                    key={mod.href}
                    href={mod.href}
                    label={mod.label}
                    Icon={mod.Icon}
                    inativo={mod.inativo}
                    ativo={
                      pathname === mod.href ||
                      (mod.href !== departamentoAtivo.baseHref && pathname.startsWith(mod.href))
                    }
                  />
                ))}
              </div>
            </div>

            {departamentoAtivo.cadastros.length > 0 && (
              <div>
                <RotuloSecao>Cadastros do setor</RotuloSecao>
                <div className="space-y-0.5">
                  {departamentoAtivo.cadastros.map((cad) => (
                    <ItemNav
                      key={cad.href}
                      href={cad.href}
                      label={cad.label}
                      Icon={cad.Icon}
                      ativo={pathname.startsWith(cad.href)}
                    />
                  ))}
                </div>
              </div>
            )}

            <Link
              href="/departamentos"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span>Todos os departamentos</span>
            </Link>
          </>
        ) : (
          <div>
            <RotuloSecao>Navegação</RotuloSecao>
            <div className="space-y-0.5">
              {ITENS_GLOBAIS.map((item) => (
                <ItemNav
                  key={item.href}
                  {...item}
                  ativo={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ---------- Rodapé fixo ---------- */}
      <div className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-4 py-3 text-[11px] text-white/30">
        <span>ERP MVP</span>
        <span>v1.0</span>
      </div>
    </aside>
  );
}
