'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Building2,
  ClipboardList,
  BarChart3,
  ChevronDown,
  ArrowLeft,
  Grid,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DEPARTMENTS, DepartmentConfig } from '@/data/departments';
import { useSidebar } from '@/context/SidebarContext';

interface MenuItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const ITEM_HOME: MenuItem = { href: '/', label: 'Home', Icon: Home };

const ITENS_GLOBAIS: MenuItem[] = [
  { href: '/cadastros', label: 'Cadastros', Icon: ClipboardList },
  { href: '/departamentos', label: 'Departamentos', Icon: Building2 },
  { href: '/relatorios', label: 'Relatórios', Icon: BarChart3 },
];

/** Rótulo de seção — um único estilo para todos os grupos da sidebar. */
function RotuloSecao({ children, isCollapsed }: { children: React.ReactNode; isCollapsed?: boolean }) {
  if (isCollapsed) {
    return <div className="my-2 border-t border-white/10" />;
  }
  return (
    <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
      {children}
    </p>
  );
}

/**
 * Linha de navegação com suporte a modo expandido e modo recolhido (ícone centralizado com tooltip).
 */
function ItemNav({
  href,
  label,
  Icon,
  ativo,
  inativo,
  isCollapsed,
}: MenuItem & { ativo: boolean; inativo?: boolean; isCollapsed?: boolean }) {
  if (inativo) {
    return (
      <span
        aria-disabled="true"
        title={`${label} (Módulo desativado)`}
        className={`flex cursor-not-allowed items-center ${
          isCollapsed ? 'justify-center py-2.5 px-0' : 'gap-3 py-2 pl-3 pr-2 border-l-2 border-transparent'
        } rounded-lg text-white/25`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {!isCollapsed && (
          <>
            <span className="truncate text-[13px] font-medium">{label}</span>
            <span className="ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wide">
              Off
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      aria-current={ativo ? 'page' : undefined}
      className={`group flex items-center ${
        isCollapsed
          ? 'justify-center py-2.5 px-0'
          : 'gap-3 py-2 pl-3 pr-2 border-l-2'
      } rounded-lg transition-all ${
        ativo
          ? 'border-brand bg-white/[0.08] text-white font-semibold'
          : 'border-transparent text-white/65 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
          ativo ? 'text-brand scale-105' : 'text-white/40 group-hover:text-white/70'
        }`}
      />
      {!isCollapsed && <span className="truncate text-[13px] font-medium">{label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

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
    <aside
      className={`z-30 flex h-screen shrink-0 flex-col select-none border-r border-white/[0.06] bg-sidebar-bg text-sidebar-muted transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* ---------- Topo fixo ---------- */}
      <div className="shrink-0 px-3 pb-4 pt-4 flex flex-col gap-3">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-1`}>
          {!isCollapsed ? (
            <Link href="/" className="flex items-center py-1">
              <img
                src="/logo.png"
                alt="MVP Sistema ERP — Delta Plano Bras"
                className="h-10 w-auto max-w-[170px] object-contain transition-opacity hover:opacity-80"
              />
            </Link>
          ) : (
            <Link href="/" title="Ir para Home" className="flex items-center justify-center py-1">
              <div className="h-9 w-9 rounded-xl bg-brand/20 border border-brand/40 text-brand flex items-center justify-center font-bold text-xs shadow-xs">
                MG
              </div>
            </Link>
          )}

          <button
            type="button"
            onClick={toggleSidebar}
            title={isCollapsed ? 'Expandir menu lateral (Ctrl+B)' : 'Recolher menu lateral (Ctrl+B)'}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        {/* Seletor de ambiente */}
        <div className="relative" ref={switcherRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
            title={isCollapsed ? (departamentoAtivo ? departamentoAtivo.name : 'Visão Geral') : undefined}
            className={`flex w-full items-center ${
              isCollapsed ? 'justify-center p-2' : 'justify-between gap-2 p-2.5'
            } rounded-xl border border-white/10 bg-white/[0.04] text-left transition-colors hover:bg-white/[0.07]`}
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
              {!isCollapsed && (
                <span className="truncate text-[13px] font-semibold text-white">
                  {departamentoAtivo ? departamentoAtivo.name : 'Visão Geral'}
                </span>
              )}
            </span>
            {!isCollapsed && (
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
              />
            )}
          </button>

          {dropdownOpen && (
            <div
              role="menu"
              className={`absolute top-full z-50 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-[#1A182D] py-1.5 shadow-2xl ${
                isCollapsed ? 'left-full ml-2 w-48' : 'left-0 w-full'
              }`}
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

              {Object.values(DEPARTMENTS)
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                .map((dept) => {
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
                          Off
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
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {departamentoAtivo?.navegacaoPorHub ? (
          <>
            <div>
              <RotuloSecao isCollapsed={isCollapsed}>{departamentoAtivo.name}</RotuloSecao>
              <ItemNav
                href={departamentoAtivo.baseHref}
                label={departamentoAtivo.hubLabel ?? 'Hub'}
                Icon={departamentoAtivo.Icon}
                ativo={pathname === departamentoAtivo.baseHref}
                isCollapsed={isCollapsed}
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                title={isCollapsed ? 'Voltar página anterior' : undefined}
                className={`flex w-full items-center ${
                  isCollapsed ? 'justify-center py-2' : 'gap-2.5 px-3 py-2 text-[13px]'
                } rounded-lg font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white`}
              >
                <ArrowLeft className="h-4 w-4 shrink-0 text-white/70" />
                {!isCollapsed && <span>Voltar página anterior</span>}
              </button>
            </div>
          </>
        ) : departamentoAtivo ? (
          <>
            <div>
              <RotuloSecao isCollapsed={isCollapsed}>{departamentoAtivo.name}</RotuloSecao>
              {departamentoAtivo.modules.slice(0, 1).map((mod) => (
                <ItemNav
                  key={mod.href}
                  href={mod.href}
                  label={mod.label}
                  Icon={mod.Icon}
                  inativo={mod.inativo}
                  isCollapsed={isCollapsed}
                  ativo={pathname === mod.href}
                />
              ))}
            </div>

            <div>
              <RotuloSecao isCollapsed={isCollapsed}>Módulos</RotuloSecao>
              <div className="space-y-0.5">
                {departamentoAtivo.modules.slice(1).map((mod) => (
                  <ItemNav
                    key={mod.href}
                    href={mod.href}
                    label={mod.label}
                    Icon={mod.Icon}
                    inativo={mod.inativo}
                    isCollapsed={isCollapsed}
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
                <RotuloSecao isCollapsed={isCollapsed}>Cadastros</RotuloSecao>
                <div className="space-y-0.5">
                  {departamentoAtivo.cadastros.map((cad) => (
                    <ItemNav
                      key={cad.href}
                      href={cad.href}
                      label={cad.label}
                      Icon={cad.Icon}
                      isCollapsed={isCollapsed}
                      ativo={pathname.startsWith(cad.href)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                title={isCollapsed ? 'Voltar página anterior' : undefined}
                className={`flex w-full items-center ${
                  isCollapsed ? 'justify-center py-2' : 'gap-2.5 px-3 py-2 text-[13px]'
                } rounded-lg font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white`}
              >
                <ArrowLeft className="h-4 w-4 shrink-0 text-white/70" />
                {!isCollapsed && <span>Voltar página anterior</span>}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <RotuloSecao isCollapsed={isCollapsed}>Início</RotuloSecao>
              <ItemNav
                key={ITEM_HOME.href}
                {...ITEM_HOME}
                isCollapsed={isCollapsed}
                ativo={pathname === '/'}
              />
            </div>

            <div>
              <RotuloSecao isCollapsed={isCollapsed}>Navegação</RotuloSecao>
              <div className="space-y-0.5">
                {ITENS_GLOBAIS.map((item) => (
                  <ItemNav
                    key={item.href}
                    {...item}
                    isCollapsed={isCollapsed}
                    ativo={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ---------- Rodapé fixo ---------- */}
      <div
        className={`flex shrink-0 items-center ${
          isCollapsed ? 'justify-center px-2 py-3 text-[10px]' : 'justify-between px-4 py-3 text-[11px]'
        } border-t border-white/[0.06] text-white/30`}
      >
        <span>{isCollapsed ? 'v1.0' : 'ERP MVP'}</span>
        {!isCollapsed && <span>v1.0</span>}
      </div>
    </aside>
  );
}
