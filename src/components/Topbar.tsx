'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Building2, LogOut, ShieldCheck, PanelLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { tituloDaRota, departamentoAtivo } from '@/lib/navegacao';

export function Topbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const activeDepartment = departamentoAtivo(pathname);

  const title = tituloDaRota(pathname);

  useEffect(() => {
    document.title = title ? `${title} — MVP` : 'MVP Sistema ERP';
  }, [title]);

  // Se estiver na tela de login, não renderiza a Topbar
  if (pathname === '/login') {
    return null;
  }

  const nomeUsuario = user?.nome || 'Renan (Administrativo)';
  const cargoUsuario = user?.cargo || 'Administrador Geral';
  const inicial = nomeUsuario.charAt(0).toUpperCase();

  return (
    // shrink-0: no app shell (body h-screen) o <main> flex-1 comprimiria a topbar
    <header className="h-20 shrink-0 px-8 flex items-center justify-between bg-transparent select-none">
      {/* Title & Department Breadcrumb Badge + Toggle Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          title={isCollapsed ? 'Expandir menu lateral (Ctrl+B)' : 'Recolher menu lateral (Ctrl+B)'}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/80 shadow-2xs transition-all active:scale-95 flex items-center justify-center shrink-0"
        >
          <PanelLeft className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? 'rotate-180 text-brand font-bold' : ''}`} />
        </button>

        {activeDepartment && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white shadow-sm border border-slate-200 text-xs font-semibold text-slate-700">
            <span className={`w-2 h-2 rounded-full ${activeDepartment.themeColor}`} />
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>{activeDepartment.name}</span>
          </div>
        )}
        {title && (
          <p className="text-2xl font-bold text-ink-primary tracking-tight">{title}</p>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-6">
        {/* User Profile */}
        <div className="flex items-center gap-3">
          <Link
            href="/perfil"
            className="flex items-center gap-3 group hover:opacity-80 transition-opacity cursor-pointer"
            title="Ver meu perfil e alterar senha"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand to-purple-600 overflow-hidden ring-2 ring-brand/30 flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
              {inicial}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-ink-primary leading-tight flex items-center gap-1">
                {nomeUsuario}
                {user?.isAcessoGeral && (
                  <span title="Acesso Geral Total">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600 inline" />
                  </span>
                )}
              </span>
              <span className="text-xs text-ink-muted leading-tight">{cargoUsuario}</span>
            </div>
          </Link>

          <button
            type="button"
            onClick={logout}
            className="ml-2 p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
            title="Sair do Sistema (Logout)"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
